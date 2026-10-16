import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

BATCH_TEMP_DIR = BASE_DIR / "batch_vault"
BATCH_TEMP_DIR.mkdir(parents=True, exist_ok=True)

CHROMA_DIR = BASE_DIR / "chroma_data"
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = BASE_DIR / "file_registry.db"

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_EMBED_MODEL = os.getenv("DEFAULT_EMBED_MODEL", "nomic-embed-text")

