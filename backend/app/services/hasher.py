import hashlib
from pathlib import Path

def compute_sha256(file_path: Path, chunk_size: int = 65536) -> str:
    """Compute the SHA-256 hash of a file efficiently by reading in chunks."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    return hasher.hexdigest()
