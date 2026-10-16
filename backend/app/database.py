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
                created_at TEXT NOT NULL
            )
        """)

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

        cursor.execute("CREATE INDEX IF NOT EXISTS idx_file_hash ON files(file_hash)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_category ON files(category)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_subfolder ON files(subfolder)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON files(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_email ON users(email)")
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

def create_user(email: str, password_hash: str, role: str = "user") -> Dict[str, Any]:
    import uuid
    user_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (id, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, email.lower().strip(), password_hash, role, now))
        conn.commit()
    return {"id": user_id, "email": email.lower().strip(), "role": role, "created_at": now}

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),))
        row = cursor.fetchone()
        return dict(row) if row else None

def list_users() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, role, created_at FROM users ORDER BY created_at ASC")
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
                INSERT INTO users (id, email, password_hash, role, created_at)
                VALUES
                ('admin-default-id', 'admin@fileorganizer.ai', ?, 'admin', ?),
                ('user-default-id', 'user@fileorganizer.ai', ?, 'user', ?)
            """, (admin_hash, datetime.utcnow().isoformat(), user_hash, datetime.utcnow().isoformat()))
            conn.commit()

