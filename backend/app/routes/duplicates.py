from fastapi import APIRouter
from pathlib import Path
from ..database import get_duplicate_groups, delete_file_record
from ..services.chroma_service import chroma_service
from ..models import CleanupDuplicatesRequest

router = APIRouter(prefix="/api/duplicates", tags=["duplicates"])

@router.get("")
def read_duplicates():
    return get_duplicate_groups()

@router.post("/cleanup")
def cleanup_duplicates(payload: CleanupDuplicatesRequest):
    groups = get_duplicate_groups()
    deleted_files = []
    freed_bytes = 0

    if payload.specific_file_ids:
        # Delete specific chosen IDs
        ids_to_delete = set(payload.specific_file_ids)
        for g in groups:
            for f in g["files"]:
                if f["id"] in ids_to_delete:
                    rec = delete_file_record(f["id"])
                    if rec:
                        try:
                            p = Path(rec["file_path"])
                            if p.exists():
                                freed_bytes += rec["file_size"]
                                p.unlink()
                        except Exception:
                            pass
                        chroma_service.delete_file(f["id"])
                        deleted_files.append(rec)
    else:
        # Automated strategy: keep first or keep latest
        for g in groups:
            files = g["files"]
            if len(files) <= 1:
                continue

            if payload.keep_strategy == "keep_latest":
                # Keep the last one, delete the rest
                to_remove = files[:-1]
            else:
                # Default "keep_first": keep the earliest upload, delete subsequent duplicates
                to_remove = files[1:]

            for f in to_remove:
                rec = delete_file_record(f["id"])
                if rec:
                    try:
                        p = Path(rec["file_path"])
                        if p.exists():
                            freed_bytes += rec["file_size"]
                            p.unlink()
                    except Exception:
                        pass
                    chroma_service.delete_file(f["id"])
                    deleted_files.append(rec)

    return {
        "deleted_count": len(deleted_files),
        "freed_bytes": freed_bytes,
        "deleted_files": [d["original_name"] for d in deleted_files]
    }
