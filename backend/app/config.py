import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Automatically load .env from project root or backend folder
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env")

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD_BYTES = int(float(os.getenv("MAX_UPLOAD_MB", "100")) * 1024 * 1024)

BATCH_TEMP_DIR = BASE_DIR / "batch_vault"
BATCH_TEMP_DIR.mkdir(parents=True, exist_ok=True)

CHROMA_DIR = BASE_DIR / "chroma_data"
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = BASE_DIR / "file_registry.db"

# Local AI settings
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_EMBED_MODEL = os.getenv("DEFAULT_EMBED_MODEL", "nomic-embed-text")

# Gmail SMTP Email Verification Settings
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "") or SMTP_USER
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "FileOrganizer AI")

# Frontend Web Application URL
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")

# Session cookie settings (set COOKIE_SECURE=true when serving over HTTPS)
SESSION_COOKIE_NAME = "fo_session"
SESSION_COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
# Sessions expire after this many minutes without a request (server-side)
SESSION_IDLE_MINUTES = int(os.getenv("SESSION_IDLE_MINUTES", "1440"))

# Token expiration & rate-limiting parameters
VERIFICATION_TOKEN_EXPIRE_HOURS = int(os.getenv("VERIFICATION_TOKEN_EXPIRE_HOURS", "24"))
RESEND_RATE_LIMIT_SECONDS = int(os.getenv("RESEND_RATE_LIMIT_SECONDS", "60"))
