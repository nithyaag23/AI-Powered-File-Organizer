import uuid
import shutil
import zipfile
import tempfile
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse

from ..config import UPLOAD_DIR, BATCH_TEMP_DIR
from ..database import (
    insert_file,
    list_files,
    get_file_by_id,
    delete_file_record,
    get_files_by_hash,
    update_file_organization,
    get_subfolders_summary
)
from ..services.hasher import compute_sha256
from ..services.category_service import (
    detect_category,
    extract_text_preview,
    analyze_file_content
)
from ..services.ollama_service import ollama_service
from ..services.chroma_service import chroma_service

router = APIRouter(prefix="/api/files", tags=["files"])

@router.post("/batch-process")
async def batch_process(
    files: List[UploadFile] = File(...),
    remove_duplicates: bool = True
):
    """
    Take an input of N files at a time:
    1. Compute SHA-256 and identify duplicate files.
    2. Analyze, organize and sort unique files into smart subfolders.
    3. Generate a single organized ZIP file containing the sorted folder tree.
    4. Return full metrics and download link without permanently hoarding files.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided for batch organization.")

    session_id = str(uuid.uuid4())
    session_dir = BATCH_TEMP_DIR / session_id
    input_dir = session_dir / "input"
    input_dir.mkdir(parents=True, exist_ok=True)

    seen_hashes = {}  # hash -> primary_file_info
    unique_files = []
    duplicate_files = []
    wasted_bytes = 0

    for f in files:
        original_name = f.filename or "unnamed_file"
        temp_file_path = input_dir / f"{uuid.uuid4().hex}_{original_name}"
        with open(temp_file_path, "wb") as buf:
            shutil.copyfileobj(f.file, buf)

        file_size = temp_file_path.stat().st_size
        file_hash = compute_sha256(temp_file_path)

        if file_hash in seen_hashes:
            # Exact duplicate within this batch!
            primary = seen_hashes[file_hash]
            wasted_bytes += file_size
            duplicate_files.append({
                "original_name": original_name,
                "duplicate_of": primary["original_name"],
                "file_size": file_size,
                "hash": file_hash
            })
            if remove_duplicates:
                # Remove duplicate copy
                try:
                    temp_file_path.unlink()
                except Exception:
                    pass
                continue

        # Unique file - classify content
        file_id = str(uuid.uuid4())
        ext = Path(original_name).suffix.lower()
        stored_name = f"{file_id}{ext}"
        permanent_path = UPLOAD_DIR / stored_name
        
        # Save permanently to vault storage
        shutil.copyfile(temp_file_path, permanent_path)

        mime_type = f.content_type or "application/octet-stream"
        text_preview = extract_text_preview(permanent_path)
        analysis = analyze_file_content(original_name, mime_type, text_preview)

        record = {
            "id": file_id,
            "original_name": original_name,
            "stored_name": stored_name,
            "file_path": str(permanent_path),
            "file_size": file_size,
            "file_hash": file_hash,
            "category": analysis["category"],
            "subfolder": analysis["subfolder"],
            "topic": analysis["topic"],
            "clean_name": analysis["clean_name"],
            "tags": analysis["tags"],
            "extension": ext,
            "mime_type": mime_type,
            "extracted_text": text_preview,
            "created_at": datetime.utcnow().isoformat()
        }

        # Store in SQLite database
        insert_file(record)

        # Index in ChromaDB vector store
        text_for_embedding = f"{analysis['clean_name']} {analysis['topic']} {analysis['subfolder']} {analysis['category']}. {text_preview}"
        embedding = ollama_service.generate_embedding(text_for_embedding)

        chroma_service.add_file(
            file_id=file_id,
            document_text=text_for_embedding,
            metadata={
                "id": file_id,
                "original_name": original_name,
                "clean_name": analysis["clean_name"],
                "category": analysis["category"],
                "subfolder": analysis["subfolder"],
                "topic": analysis["topic"],
                "file_size": file_size,
                "extension": ext,
                "file_hash": file_hash
            },
            embedding=embedding
        )

        file_info = {
            **record,
            "temp_path": str(permanent_path)
        }
        seen_hashes[file_hash] = file_info
        unique_files.append(file_info)

    # Package into Organized_Files.zip
    zip_path = session_dir / "Organized_Files.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for uf in unique_files:
            src = Path(uf["temp_path"])
            if src.exists():
                arcname = f"Organized_Files/{uf['subfolder']}/{uf['clean_name']}"
                zipf.write(src, arcname=arcname)

    # Clean up input temporary directory
    shutil.rmtree(input_dir, ignore_errors=True)

    # Group unique files by subfolder for clean UI tree display
    folders_map = {}
    for uf in unique_files:
        sub = uf["subfolder"]
        if sub not in folders_map:
            folders_map[sub] = {
                "subfolder": sub,
                "category": uf["category"],
                "count": 0,
                "total_size": 0,
                "files": []
            }
        folders_map[sub]["count"] += 1
        folders_map[sub]["total_size"] += uf["file_size"]
        folders_map[sub]["files"].append({
            "name": uf["clean_name"],
            "original_name": uf["original_name"],
            "size": uf["file_size"],
            "topic": uf["topic"]
        })

    return {
        "session_id": session_id,
        "total_files": len(files),
        "unique_files_count": len(unique_files),
        "duplicates_removed_count": len(duplicate_files),
        "wasted_bytes_saved": wasted_bytes,
        "folders": list(folders_map.values()),
        "duplicate_files": duplicate_files,
        "download_url": f"/api/files/batch-download/{session_id}"
    }

@router.get("/batch-download/{session_id}")
def batch_download(session_id: str, background_tasks: BackgroundTasks):
    session_dir = BATCH_TEMP_DIR / session_id
    zip_path = session_dir / "Organized_Files.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Organized zip not found or session has expired.")

    def cleanup():
        try:
            shutil.rmtree(session_dir, ignore_errors=True)
        except Exception:
            pass

    background_tasks.add_task(cleanup)

    return FileResponse(
        path=zip_path,
        filename="Organized_Files.zip",
        media_type="application/zip"
    )

@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    results = []
    for file in files:
        file_id = str(uuid.uuid4())
        original_name = file.filename or "unnamed_file"
        ext = Path(original_name).suffix.lower()
        stored_name = f"{file_id}{ext}"
        saved_path = UPLOAD_DIR / stored_name

        # Save file to disk
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = saved_path.stat().st_size
        file_hash = compute_sha256(saved_path)
        mime_type = file.content_type or "application/octet-stream"
        extracted_text = extract_text_preview(saved_path)

        # Smart content-based classification
        analysis = analyze_file_content(original_name, mime_type, extracted_text)

        # Exact duplicate detection: check if hash already exists in registry
        existing_with_hash = get_files_by_hash(file_hash)
        is_duplicate = len(existing_with_hash) > 0

        # Create record in DB with subfolder, topic, clean_name, and tags
        record = {
            "id": file_id,
            "original_name": original_name,
            "stored_name": stored_name,
            "file_path": str(saved_path),
            "file_size": file_size,
            "file_hash": file_hash,
            "category": analysis["category"],
            "subfolder": analysis["subfolder"],
            "topic": analysis["topic"],
            "clean_name": analysis["clean_name"],
            "tags": analysis["tags"],
            "extension": ext,
            "mime_type": mime_type,
            "extracted_text": extracted_text,
            "created_at": datetime.utcnow().isoformat()
        }
        insert_file(record)

        # Generate embedding via Ollama (or fast local vector) & store in ChromaDB
        text_for_embedding = f"{analysis['clean_name']} {analysis['topic']} {analysis['subfolder']}. {extracted_text}"
        embedding = ollama_service.generate_embedding(text_for_embedding)

        chroma_service.add_file(
            file_id=file_id,
            document_text=text_for_embedding,
            metadata={
                "id": file_id,
                "original_name": original_name,
                "clean_name": analysis["clean_name"],
                "category": analysis["category"],
                "subfolder": analysis["subfolder"],
                "topic": analysis["topic"],
                "file_size": file_size,
                "extension": ext,
                "file_hash": file_hash
            },
            embedding=embedding
        )

        results.append({
            **record,
            "is_duplicate": is_duplicate,
            "existing_duplicate_count": len(existing_with_hash)
        })

    return {"uploaded_count": len(results), "files": results}

@router.get("")
def get_files(
    category: Optional[str] = Query(None),
    subfolder: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc")
):
    files = list_files(
        category=category,
        subfolder=subfolder,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order
    )
    return files

@router.get("/subfolders")
def get_subfolders():
    """List all hierarchical subfolders with file counts and sizes."""
    return get_subfolders_summary()

@router.post("/reorganize")
def reorganize_files():
    """Re-analyze all files in the vault and apply smart subfolder & topic classification."""
    all_files = list_files()
    updated = []
    for f in all_files:
        analysis = analyze_file_content(f["original_name"], f["mime_type"], f.get("extracted_text", "") or "")
        update_file_organization(
            file_id=f["id"],
            subfolder=analysis["subfolder"],
            topic=analysis["topic"],
            clean_name=analysis["clean_name"],
            tags=analysis["tags"]
        )
        updated.append({
            "id": f["id"],
            "original_name": f["original_name"],
            "clean_name": analysis["clean_name"],
            "subfolder": analysis["subfolder"],
            "topic": analysis["topic"]
        })
    return {"status": "success", "reorganized_count": len(updated), "files": updated}

@router.get("/download-organized-zip")
def download_organized_zip(background_tasks: BackgroundTasks):
    """Bundle all files into their respective subfolders in a ZIP file."""
    all_files = list_files()
    if not all_files:
        raise HTTPException(status_code=400, detail="No files available to organize and download.")

    # Create a temporary zip file
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    temp_zip_path = Path(temp_zip.name)
    temp_zip.close()

    try:
        with zipfile.ZipFile(temp_zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for f in all_files:
                src_path = Path(f["file_path"])
                if src_path.exists():
                    sub = f.get("subfolder") or f.get("category") or "Other"
                    clean_filename = f.get("clean_name") or f.get("original_name")
                    # Archive path inside zip: e.g. "Academics/Physics/PHY102 Lab Viva Answers.pdf"
                    zip_archive_path = f"Organized_Files/{sub}/{clean_filename}"
                    zipf.write(src_path, arcname=zip_archive_path)

        def remove_temp_file():
            try:
                temp_zip_path.unlink(missing_ok=True)
            except Exception:
                pass

        background_tasks.add_task(remove_temp_file)

        return FileResponse(
            path=temp_zip_path,
            filename="Organized_Files.zip",
            media_type="application/zip"
        )
    except Exception as e:
        temp_zip_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to create organized ZIP: {str(e)}")

@router.get("/{file_id}")
def get_file(file_id: str):
    file_record = get_file_by_id(file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    return file_record

@router.get("/{file_id}/download")
def download_file(file_id: str):
    file_record = get_file_by_id(file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    path = Path(file_record["file_path"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="File content missing from local storage")
    
    return FileResponse(
        path=path,
        filename=file_record.get("clean_name") or file_record["original_name"],
        media_type=file_record.get("mime_type", "application/octet-stream")
    )

@router.delete("/{file_id}")
def delete_file(file_id: str):
    record = delete_file_record(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        path = Path(record["file_path"])
        if path.exists():
            path.unlink()
    except Exception:
        pass

    chroma_service.delete_file(file_id)

    return {"deleted": True, "file_id": file_id, "original_name": record["original_name"]}
