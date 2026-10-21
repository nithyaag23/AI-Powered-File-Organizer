import json
import sqlite3
from typing import List, Dict, Any, Optional
from datetime import datetime
from .config import DB_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY,
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_hash TEXT NOT NULL,
                category TEXT NOT NULL,
                extension TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                extracted_text TEXT,
                subfolder TEXT DEFAULT '',
                topic TEXT DEFAULT '',
                clean_name TEXT DEFAULT '',
                tags TEXT DEFAULT '[]',
                created_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                is_verified INTEGER DEFAULT 0,
                last_verification_sent_at TEXT,
                created_at TEXT NOT NULL
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS login_challenges (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                challenge_id TEXT NOT NULL UNIQUE,
                otp_hash TEXT NOT NULL,
                attempts INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                last_sent_at TEXT NOT NULL,
                used_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pending_registrations (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                otp_hash TEXT NOT NULL DEFAULT '',
                token_hash TEXT NOT NULL DEFAULT '',
                attempts INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                last_sent_at TEXT NOT NULL
            )
        """)

        # Migration: ensure pending_registrations columns exist
        cursor.execute("PRAGMA table_info(pending_registrations)")
        existing_pending_cols = {row["name"] for row in cursor.fetchall()}
        if "otp_hash" not in existing_pending_cols:
            cursor.execute("ALTER TABLE pending_registrations ADD COLUMN otp_hash TEXT NOT NULL DEFAULT ''")
        if "attempts" not in existing_pending_cols:
            cursor.execute("ALTER TABLE pending_registrations ADD COLUMN attempts INTEGER DEFAULT 0")

        # Migration: ensure new columns exist if table was already created
        cursor.execute("PRAGMA table_info(files)")
        existing_cols = {row["name"] for row in cursor.fetchall()}
        if "subfolder" not in existing_cols:
            cursor.execute("ALTER TABLE files ADD COLUMN subfolder TEXT DEFAULT ''")
        if "topic" not in existing_cols:
            cursor.execute("ALTER TABLE files ADD COLUMN topic TEXT DEFAULT ''")
        if "clean_name" not in existing_cols:
            cursor.execute("ALTER TABLE files ADD COLUMN clean_name TEXT DEFAULT ''")
        if "tags" not in existing_cols:
            cursor.execute("ALTER TABLE files ADD COLUMN tags TEXT DEFAULT '[]'")

        # Migration: ensure users columns exist
        cursor.execute("PRAGMA table_info(users)")
        existing_user_cols = {row["name"] for row in cursor.fetchall()}
        if "is_verified" not in existing_user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0")
            cursor.execute("UPDATE users SET is_verified = 1 WHERE email IN ('admin@fileorganizer.ai', 'user@fileorganizer.ai')")
        if "last_verification_sent_at" not in existing_user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN last_verification_sent_at TEXT")

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_file_hash ON files(file_hash)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_category ON files(category)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_subfolder ON files(subfolder)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON files(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_email ON users(email)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_verification_token_hash ON email_verification_tokens(token_hash)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_verification_user_id ON email_verification_tokens(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_challenge_id ON login_challenges(challenge_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_challenge_user_id ON login_challenges(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_token_hash ON sessions(token_hash)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pending_reg_email ON pending_registrations(email)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_pending_reg_token ON pending_registrations(token_hash)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session_user_id ON sessions(user_id)")
        conn.commit()

    # Seed default admin and user
    seed_default_users()

    # Backfill any files missing subfolders
    backfill_existing_files()

def insert_file(file_data: Dict[str, Any]):
    tags_val = file_data.get("tags", [])
    if isinstance(tags_val, list):
        tags_str = json.dumps(tags_val)
    else:
        tags_str = str(tags_val)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO files (
                id, original_name, stored_name, file_path, file_size,
                file_hash, category, extension, mime_type, extracted_text,
                subfolder, topic, clean_name, tags, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            file_data["id"],
            file_data["original_name"],
            file_data["stored_name"],
            file_data["file_path"],
            file_data["file_size"],
            file_data["file_hash"],
            file_data["category"],
            file_data["extension"],
            file_data["mime_type"],
            file_data.get("extracted_text", ""),
            file_data.get("subfolder", f"{file_data['category']}/General"),
            file_data.get("topic", "General"),
            file_data.get("clean_name", file_data["original_name"]),
            tags_str,
            file_data.get("created_at", datetime.utcnow().isoformat())
        ))
        conn.commit()

def update_file_organization(file_id: str, subfolder: str, topic: str, clean_name: str, tags: List[str]):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE files
            SET subfolder = ?, topic = ?, clean_name = ?, tags = ?
            WHERE id = ?
        """, (subfolder, topic, clean_name, json.dumps(tags), file_id))
        conn.commit()

def _format_file_row(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    # Parse tags json
    try:
        d["tags"] = json.loads(d.get("tags") or "[]")
    except Exception:
        d["tags"] = []
    if not d.get("clean_name"):
        d["clean_name"] = d.get("original_name", "")
    if not d.get("subfolder"):
        d["subfolder"] = f"{d.get('category', 'Other')}/General"
    if not d.get("topic"):
        d["topic"] = "General"
    return d

def get_file_by_id(file_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,))
        row = cursor.fetchone()
        return _format_file_row(row) if row else None

def get_files_by_hash(file_hash: str) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM files WHERE file_hash = ? ORDER BY created_at ASC", (file_hash,))
        return [_format_file_row(row) for row in cursor.fetchall()]

def list_files(
    category: Optional[str] = None,
    subfolder: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc"
) -> List[Dict[str, Any]]:
    valid_sort_cols = {"created_at", "original_name", "clean_name", "file_size", "category", "subfolder"}
    col = sort_by if sort_by in valid_sort_cols else "created_at"
    order = "ASC" if sort_order.lower() == "asc" else "DESC"

    query = "SELECT * FROM files WHERE 1=1"
    params: List[Any] = []

    if category and category.lower() != "all":
        query += " AND category = ?"
        params.append(category)

    if subfolder:
        query += " AND subfolder = ?"
        params.append(subfolder)

    if search:
        query += " AND (original_name LIKE ? OR clean_name LIKE ? OR topic LIKE ? OR subfolder LIKE ? OR extracted_text LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard, wildcard, wildcard])

    query += f" ORDER BY {col} {order}"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [_format_file_row(row) for row in cursor.fetchall()]

def get_duplicate_groups() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT file_hash, COUNT(*) as count, SUM(file_size) as total_size
            FROM files
            GROUP BY file_hash
            HAVING count > 1
        """)
        groups = cursor.fetchall()
        result = []
        for g in groups:
            h = g["file_hash"]
            cursor.execute("SELECT * FROM files WHERE file_hash = ? ORDER BY created_at ASC", (h,))
            files_in_group = [_format_file_row(row) for row in cursor.fetchall()]
            result.append({
                "hash": h,
                "count": len(files_in_group),
                "file_size": files_in_group[0]["file_size"] if files_in_group else 0,
                "wasted_size": (len(files_in_group) - 1) * (files_in_group[0]["file_size"] if files_in_group else 0),
                "files": files_in_group
            })
        return result

def get_subfolders_summary() -> List[Dict[str, Any]]:
    """Returns folder tree with counts and sizes."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT subfolder, category, COUNT(*) as count, SUM(file_size) as size
            FROM files
            GROUP BY subfolder
            ORDER BY subfolder ASC
        """)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def get_stats() -> Dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as total_files, COALESCE(SUM(file_size), 0) as total_size FROM files")
        tot = cursor.fetchone()
        total_files = tot["total_files"]
        total_size = tot["total_size"]

        cursor.execute("""
            SELECT file_hash, COUNT(*) as cnt, MAX(file_size) as f_size
            FROM files
            GROUP BY file_hash
            HAVING cnt > 1
        """)
        dup_rows = cursor.fetchall()
        duplicate_files_count = sum(r["cnt"] - 1 for r in dup_rows)
        duplicate_wasted_size = sum((r["cnt"] - 1) * r["f_size"] for r in dup_rows)

        categories = ["Documents", "Images", "Videos", "Audio", "Archives", "Other"]
        cat_stats = {c: {"count": 0, "size": 0} for c in categories}
        cursor.execute("SELECT category, COUNT(*) as count, SUM(file_size) as size FROM files GROUP BY category")
        for row in cursor.fetchall():
            c = row["category"]
            if c in cat_stats:
                cat_stats[c] = {"count": row["count"], "size": row["size"]}
            else:
                cat_stats["Other"]["count"] += row["count"]
                cat_stats["Other"]["size"] += row["size"]

        cursor.execute("SELECT * FROM files ORDER BY created_at DESC LIMIT 6")
        recent_files = [_format_file_row(r) for r in cursor.fetchall()]

        subfolders = get_subfolders_summary()

        return {
            "total_files": total_files,
            "total_size": total_size,
            "duplicate_files_count": duplicate_files_count,
            "duplicate_wasted_size": duplicate_wasted_size,
            "categories": cat_stats,
            "subfolders": subfolders,
            "recent_files": recent_files
        }

def delete_file_record(file_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,))
        row = cursor.fetchone()
        if not row:
            return None
        file_dict = _format_file_row(row)
        cursor.execute("DELETE FROM files WHERE id = ?", (file_id,))
        conn.commit()
        return file_dict

def clear_all_records() -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM files")
        deleted = cursor.rowcount
        conn.commit()
        return deleted

def backfill_existing_files():
    """Analyze and populate smart subfolders, topics, and clean names for any existing records."""
    from .services.category_service import analyze_file_content
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, original_name, mime_type, extracted_text, subfolder FROM files")
        rows = cursor.fetchall()
        for r in rows:
            # If missing subfolder or generic
            if not r["subfolder"] or r["subfolder"].endswith("/General") or r["subfolder"] == "":
                analysis = analyze_file_content(r["original_name"], r["mime_type"], r["extracted_text"] or "")
                cursor.execute("""
                    UPDATE files
                    SET subfolder = ?, topic = ?, clean_name = ?, tags = ?
                    WHERE id = ?
                """, (
                    analysis["subfolder"],
                    analysis["topic"],
                    analysis["clean_name"],
                    json.dumps(analysis["tags"]),
                    r["id"]
                ))
        conn.commit()

def create_user(email: str, password_hash: str, role: str = "user", is_verified: int = 0) -> Dict[str, Any]:
    import uuid
    user_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (id, email, password_hash, role, is_verified, last_verification_sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, NULL, ?)
        """, (user_id, email.lower().strip(), password_hash, role, is_verified, now))
        conn.commit()
    return {
        "id": user_id,
        "email": email.lower().strip(),
        "role": role,
        "is_verified": is_verified,
        "last_verification_sent_at": None,
        "created_at": now
    }

def delete_user(user_id: str) -> None:
    """Delete user and all associated tokens (e.g. if email dispatch fails on signup)."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM email_verification_tokens WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),))
        row = cursor.fetchone()
        return dict(row) if row else None

def set_user_verified(user_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_verified = 1 WHERE id = ?", (user_id,))
        conn.commit()
        return cursor.rowcount > 0

def update_last_verification_sent(user_id: str, timestamp_iso: str) -> None:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET last_verification_sent_at = ? WHERE id = ?", (timestamp_iso, user_id))
        conn.commit()

def create_verification_token(user_id: str, token_hash: str, expires_at_iso: str) -> Dict[str, Any]:
    import uuid
    token_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO email_verification_tokens (id, user_id, token_hash, created_at, expires_at, used_at)
            VALUES (?, ?, ?, ?, ?, NULL)
        """, (token_id, user_id, token_hash, now, expires_at_iso))
        conn.commit()
    return {
        "id": token_id,
        "user_id": user_id,
        "token_hash": token_hash,
        "created_at": now,
        "expires_at": expires_at_iso,
        "used_at": None
    }

def get_verification_token_by_hash(token_hash: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM email_verification_tokens WHERE token_hash = ?", (token_hash,))
        row = cursor.fetchone()
        return dict(row) if row else None

def mark_verification_token_used(token_id: str) -> None:
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE email_verification_tokens SET used_at = ? WHERE id = ?", (now, token_id))
        conn.commit()

def invalidate_user_verification_tokens(user_id: str) -> None:
    """Invalidate all prior unused verification tokens for a given user."""
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE email_verification_tokens
            SET used_at = ?
            WHERE user_id = ? AND used_at IS NULL
        """, (now, user_id))
        conn.commit()

# ==============================================================================
# Pending Registrations (Staging before email is verified)
# ==============================================================================

def create_or_update_pending_registration(
    email: str,
    password_hash: str,
    role: str,
    otp_hash: str,
    token_hash: str,
    expires_at_iso: str
) -> Dict[str, Any]:
    """
    Stage an unverified registration with an OTP challenge.
    The users table is NEVER touched until OTP verification succeeds!
    If a pending registration for this email already exists, replace it cleanly so the user is never blocked.
    """
    import uuid
    clean_email = email.lower().strip()
    record_id = f"reg_{uuid.uuid4().hex}"
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM pending_registrations WHERE email = ?", (clean_email,))
        cursor.execute("""
            INSERT INTO pending_registrations (id, email, password_hash, role, otp_hash, token_hash, attempts, created_at, expires_at, last_sent_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        """, (record_id, clean_email, password_hash, role, otp_hash, token_hash, now, expires_at_iso, now))
        conn.commit()
    return {
        "id": record_id,
        "challenge_id": record_id,
        "email": clean_email,
        "role": role,
        "otp_hash": otp_hash,
        "token_hash": token_hash,
        "attempts": 0,
        "created_at": now,
        "expires_at": expires_at_iso,
        "last_sent_at": now
    }

def get_pending_registration_by_id(record_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pending_registrations WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def increment_pending_registration_attempts(record_id: str) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE pending_registrations SET attempts = attempts + 1 WHERE id = ?", (record_id,))
        cursor.execute("SELECT attempts FROM pending_registrations WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        conn.commit()
        return row["attempts"] if row else 1

def update_pending_registration_otp(record_id: str, new_otp_hash: str, new_token_hash: str, new_expires_at: str, now_iso: str) -> None:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE pending_registrations
            SET otp_hash = ?, token_hash = ?, expires_at = ?, last_sent_at = ?, attempts = 0
            WHERE id = ?
        """, (new_otp_hash, new_token_hash, new_expires_at, now_iso, record_id))
        conn.commit()

def get_pending_registration_by_token(token_hash: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pending_registrations WHERE token_hash = ?", (token_hash,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_pending_registration_by_email(email: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pending_registrations WHERE email = ?", (email.lower().strip(),))
        row = cursor.fetchone()
        return dict(row) if row else None

def update_pending_registration_token(email: str, token_hash: str, expires_at_iso: str) -> None:
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE pending_registrations
            SET token_hash = ?, expires_at = ?, last_sent_at = ?
            WHERE email = ?
        """, (token_hash, expires_at_iso, now, email.lower().strip()))
        conn.commit()

def delete_pending_registration(email: str) -> None:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM pending_registrations WHERE email = ?", (email.lower().strip(),))
        conn.commit()

def list_users() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, role, is_verified, created_at FROM users ORDER BY created_at ASC")
        return [dict(row) for row in cursor.fetchall()]

def seed_default_users():
    """Seed default admin and user if not exists."""
    from .services.auth_service import hash_password
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM users")
        count = cursor.fetchone()["count"]
        if count == 0:
            # Passwords fulfill: alphabet, integer, special char, len >= 10
            admin_hash = hash_password("Admin@12345#")
            user_hash = hash_password("User@12345#")
            cursor.execute("""
                INSERT INTO users (id, email, password_hash, role, is_verified, last_verification_sent_at, created_at)
                VALUES
                ('admin-default-id', 'admin@fileorganizer.ai', ?, 'admin', 1, NULL, ?),
                ('user-default-id', 'user@fileorganizer.ai', ?, 'user', 1, NULL, ?)
            """, (admin_hash, datetime.utcnow().isoformat(), user_hash, datetime.utcnow().isoformat()))
            conn.commit()

# ==============================================================================
# Login Challenge & OTP Management
# ==============================================================================

def create_login_challenge(user_id: str, challenge_id: str, otp_hash: str, expires_at_iso: str) -> Dict[str, Any]:
    import uuid
    record_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO login_challenges (id, user_id, challenge_id, otp_hash, attempts, created_at, expires_at, last_sent_at, used_at)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL)
        """, (record_id, user_id, challenge_id, otp_hash, now, expires_at_iso, now))
        conn.commit()
    return {
        "id": record_id,
        "user_id": user_id,
        "challenge_id": challenge_id,
        "otp_hash": otp_hash,
        "attempts": 0,
        "created_at": now,
        "expires_at": expires_at_iso,
        "last_sent_at": now,
        "used_at": None
    }

def get_login_challenge(challenge_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM login_challenges WHERE challenge_id = ?", (challenge_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def increment_challenge_attempts(challenge_id: str) -> int:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE login_challenges
            SET attempts = attempts + 1
            WHERE challenge_id = ?
        """, (challenge_id,))
        conn.commit()
        cursor.execute("SELECT attempts FROM login_challenges WHERE challenge_id = ?", (challenge_id,))
        row = cursor.fetchone()
        return row["attempts"] if row else 1

def update_login_challenge_otp(challenge_id: str, new_otp_hash: str, new_expires_at: str, sent_at_iso: str) -> None:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE login_challenges
            SET otp_hash = ?, expires_at = ?, last_sent_at = ?, attempts = 0
            WHERE challenge_id = ?
        """, (new_otp_hash, new_expires_at, sent_at_iso, challenge_id))
        conn.commit()

def mark_challenge_used(challenge_id: str) -> None:
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE login_challenges SET used_at = ? WHERE challenge_id = ?", (now, challenge_id))
        conn.commit()

def invalidate_user_login_challenges(user_id: str) -> None:
    """Invalidate all prior unused login challenges for a user."""
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE login_challenges
            SET used_at = ?
            WHERE user_id = ? AND used_at IS NULL
        """, (now, user_id))
        conn.commit()

# ==============================================================================
# Authenticated Session Management
# ==============================================================================

def create_session(user_id: str, raw_token: str, expires_at_iso: str) -> Dict[str, Any]:
    import uuid
    from .services.auth_service import hash_token
    session_id = str(uuid.uuid4())
    token_hash = hash_token(raw_token)
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
        """, (session_id, user_id, token_hash, now, expires_at_iso))
        conn.commit()
    return {
        "id": session_id,
        "user_id": user_id,
        "token_hash": token_hash,
        "created_at": now,
        "expires_at": expires_at_iso
    }

def get_session_by_token(raw_token: str) -> Optional[Dict[str, Any]]:
    from .services.auth_service import hash_token
    token_hash = hash_token(raw_token)
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM sessions
            WHERE token_hash = ? AND expires_at > ?
        """, (token_hash, now))
        row = cursor.fetchone()
        return dict(row) if row else None

def delete_session_by_token(raw_token: str) -> None:
    from .services.auth_service import hash_token
    token_hash = hash_token(raw_token)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        conn.commit()

def cleanup_expired_sessions() -> None:
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
        conn.commit()

