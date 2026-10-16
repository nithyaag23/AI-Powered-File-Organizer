import shutil
from fastapi import APIRouter
from pathlib import Path

from ..config import UPLOAD_DIR, CHROMA_DIR, DB_PATH, OLLAMA_BASE_URL, DEFAULT_EMBED_MODEL
from ..services.ollama_service import ollama_service
from ..services.chroma_service import chroma_service
from ..database import clear_all_records, get_stats

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("/status")
def system_status():
    ollama_info = ollama_service.check_health()
    stats = get_stats()

    chroma_count = 0
    chroma_ok = False
    try:
        if chroma_service.collection:
            chroma_count = chroma_service.collection.count()
            chroma_ok = True
    except Exception:
        pass

    return {
        "backend": {
            "status": "online",
            "version": "1.0.0",
            "port": 8000,
            "host": "127.0.0.1"
        },
        "storage": {
            "upload_dir": str(UPLOAD_DIR),
            "total_files": stats["total_files"],
            "total_size": stats["total_size"]
        },
        "ollama": {
            "base_url": OLLAMA_BASE_URL,
            "connected": ollama_info["connected"],
            "models": ollama_info["models"],
            "active_model": DEFAULT_EMBED_MODEL,
            "model_ready": ollama_info.get("model_available", False),
            "instructions": "Run 'ollama pull nomic-embed-text' in your terminal if you need local embeddings."
        },
        "chromadb": {
            "initialized": chroma_ok,
            "path": str(CHROMA_DIR),
            "collection_count": chroma_count
        }
    }

@router.post("/clear-all")
def clear_all():
    # Clear database records
    deleted_count = clear_all_records()

    # Clear uploads directory
    try:
        for item in UPLOAD_DIR.iterdir():
            if item.is_file():
                item.unlink()
            elif item.is_dir():
                shutil.rmtree(item)
    except Exception:
        pass

    # Clear ChromaDB vectors
    chroma_service.clear()

    return {"status": "success", "message": f"Cleared {deleted_count} files from registry and disk."}
