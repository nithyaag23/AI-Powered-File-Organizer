import re
import hashlib
import secrets
from typing import Tuple, Optional, Dict, Any
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

def validate_password(password: str) -> Tuple[bool, str]:
    """
    Validate password requirements:
    1. At least one alphabet character
    2. At least one integer
    3. At least one special character
    4. Minimum 10 characters length
    """
    if not password:
        return False, "Password cannot be empty."

    if len(password) < 10:
        return False, "Password must be at least 10 characters long."

    if not re.search(r"[a-zA-Z]", password):
        return False, "Password must contain at least one alphabet character (a-z, A-Z)."

    if not re.search(r"\d", password):
        return False, "Password must contain at least one integer (0-9)."

    if not re.search(r"[!@#$%^&*(),.?\":{}|<>[\]\\/`~_+=;' -]", password):
        return False, "Password must contain at least one special character (!@#$%^&*...)."

    return True, "Password is valid."

PBKDF2_ITERATIONS = 310_000  # OWASP-recommended minimum for PBKDF2-HMAC-SHA256

def hash_password(password: str) -> str:
    """Hash a password with salted PBKDF2-HMAC-SHA256 (deliberately slow to resist brute force)."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${key}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password. Legacy fast-SHA-256 records ("salt$hash") remain verifiable so existing accounts keep working."""
    try:
        if stored_hash.startswith("pbkdf2_sha256$"):
            _, iterations, salt, key = stored_hash.split("$", 3)
            expected = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations)).hex()
            return secrets.compare_digest(key, expected)
        salt, key = stored_hash.split("$", 1)
        expected = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
        return secrets.compare_digest(key, expected)
    except Exception:
        return False

def hash_token(token: str) -> str:
    """
    Compute cryptographic SHA-256 hash of a token or session key.
    Only the hash is stored in the database for security.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def generate_verification_token() -> Tuple[str, str]:
    """
    Generate a cryptographically secure, high-entropy URL-safe token
    and its SHA-256 hash.
    Returns: (raw_token, token_hash)
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    return raw_token, token_hash

def generate_otp() -> str:
    """
    Generate a cryptographically secure, random 6-digit numeric OTP (100000 - 999999).
    """
    return f"{secrets.randbelow(900000) + 100000:06d}"

def hash_otp(challenge_id: str, otp: str) -> str:
    """
    Salted cryptographic SHA-256 hash of the OTP tied to the challenge ID.
    Precomputed rainbow tables cannot be used across challenges.
    """
    clean_otp = str(otp).strip()
    return hashlib.sha256(f"{challenge_id}:{clean_otp}".encode("utf-8")).hexdigest()

def generate_challenge_id() -> str:
    """Generate a random, URL-safe challenge token identifier."""
    return f"ch_{secrets.token_urlsafe(32)}"

def get_session_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = None) -> Optional[str]:
    """Session token from the httpOnly cookie, or from a Bearer header (API clients)."""
    from ..config import SESSION_COOKIE_NAME
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token.strip()
    if credentials and credentials.credentials:
        return credentials.credentials.strip()
    return None

def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    FastAPI dependency that enforces authenticated session access on protected routes.
    Validates the session token (cookie or Bearer) against the sessions table.
    """
    from ..database import get_session_by_token, get_user_by_id

    raw_token = get_session_token(request, credentials)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in with email and OTP.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    session = get_session_by_token(raw_token)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = get_user_by_id(session["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return user
