import re
import hashlib
import secrets
from typing import Tuple

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

def hash_password(password: str) -> str:
    """Generate salted SHA-256 hash."""
    salt = secrets.token_hex(16)
    key = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
    return f"{salt}${key}"

def verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against salted hash."""
    try:
        salt, key = stored_hash.split("$", 1)
        expected_key = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
        return secrets.compare_digest(key, expected_key)
    except Exception:
        return False
