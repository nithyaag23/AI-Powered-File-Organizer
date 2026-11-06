import io
import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import init_db, create_user, create_session, clear_all_records
from app.services.auth_service import hash_password
from app.services.ollama_service import ollama_service
import app.routes.files as files_routes

init_db()
client = TestClient(app)


@pytest.fixture(autouse=True)
def _offline_embeddings(monkeypatch):
    # Keep tests fast and deterministic: no Ollama calls
    monkeypatch.setattr(ollama_service, "generate_embedding", lambda *a, **k: None)
    clear_all_records()
    yield
    clear_all_records()


def _auth_headers(role: str = "user") -> dict:
    email = f"{role}-{uuid.uuid4().hex[:8]}@example.com"
    user = create_user(email=email, password_hash=hash_password("Passw0rd!xyz"), role=role, is_verified=1)
    token = f"tok_{uuid.uuid4().hex}"
    create_session(user["id"], token, (datetime.utcnow() + timedelta(days=1)).isoformat())
    return {"Authorization": f"Bearer {token}"}


def _upload(headers, name: str, content: bytes):
    return client.post("/api/files/upload", files={"files": (name, io.BytesIO(content), "text/plain")}, headers=headers)


def test_file_routes_require_login():
    assert client.get("/api/files").status_code == 401
    assert client.get("/api/stats").status_code == 401
    assert client.get("/api/duplicates").status_code == 401


def test_upload_list_download_delete_roundtrip():
    h = _auth_headers()
    res = _upload(h, "notes.txt", b"hello world")
    assert res.status_code == 200
    file_id = res.json()["files"][0]["id"]

    listed = client.get("/api/files", headers=h).json()
    assert any(f["id"] == file_id for f in listed)

    dl = client.get(f"/api/files/{file_id}/download", headers=h)
    assert dl.status_code == 200 and dl.content == b"hello world"

    assert client.delete(f"/api/files/{file_id}", headers=h).status_code == 200
    assert client.get(f"/api/files/{file_id}", headers=h).status_code == 404


def test_upload_rejects_oversized_file(monkeypatch):
    monkeypatch.setattr(files_routes, "MAX_UPLOAD_BYTES", 10)
    res = _upload(_auth_headers(), "big.txt", b"x" * 50)
    assert res.status_code == 413


def test_upload_strips_directory_parts_from_filename():
    res = _upload(_auth_headers(), "../../evil.txt", b"data")
    assert res.status_code == 200
    assert res.json()["files"][0]["original_name"] == "evil.txt"


def test_duplicate_detection_and_cleanup_keeps_one_copy():
    h = _auth_headers()
    first = _upload(h, "a.txt", b"same bytes").json()["files"][0]["id"]
    second = _upload(h, "b.txt", b"same bytes").json()["files"][0]["id"]

    groups = client.get("/api/duplicates", headers=h).json()
    assert len(groups) == 1 and groups[0]["count"] == 2

    # Asking to delete both copies must still keep one
    res = client.post("/api/duplicates/cleanup", json={"specific_file_ids": [first, second]}, headers=h)
    assert res.status_code == 200
    assert res.json()["deleted_count"] == 1
    assert client.get("/api/duplicates", headers=h).json() == []


def test_batch_process_removes_in_batch_duplicates():
    h = _auth_headers()
    files = [
        ("files", ("one.txt", io.BytesIO(b"same"), "text/plain")),
        ("files", ("two.txt", io.BytesIO(b"same"), "text/plain")),
        ("files", ("three.txt", io.BytesIO(b"other"), "text/plain")),
    ]
    res = client.post("/api/files/batch-process", files=files, headers=h)
    assert res.status_code == 200
    body = res.json()
    assert body["unique_files_count"] == 2
    assert body["duplicates_removed_count"] == 1


def test_clear_all_is_admin_only():
    assert client.post("/api/settings/clear-all", headers=_auth_headers("user")).status_code == 403
    assert client.post("/api/settings/clear-all", headers=_auth_headers("admin")).status_code == 200


def test_reorganize_reembeds_files_once_ollama_is_available(monkeypatch):
    from app.services.chroma_service import chroma_service
    h = _auth_headers()
    file_id = _upload(h, "lecture.txt", b"offline indexed").json()["files"][0]["id"]
    vector = [0.25] * 768
    monkeypatch.setattr(ollama_service, "generate_embedding", lambda *a, **k: vector)
    res = client.post("/api/files/reorganize", headers=h)
    assert res.status_code == 200
    assert res.json()["reembedded_count"] >= 1
    hits = chroma_service.search_semantic("lecture", query_embedding=vector, n_results=50)
    assert any(hit["file_id"] == file_id for hit in hits)


def test_batch_process_skips_files_already_in_library():
    h = _auth_headers()
    _upload(h, "existing.txt", b"already stored")
    files = [("files", ("again.txt", io.BytesIO(b"already stored"), "text/plain"))]
    body = client.post("/api/files/batch-process", files=files, headers=h).json()
    assert body["unique_files_count"] == 0
    assert body["duplicates_removed_count"] == 1
    assert body["duplicate_files"][0]["duplicate_of"] == "existing.txt"
