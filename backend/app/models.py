from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class FileItemResponse(BaseModel):
    id: str
    original_name: str
    stored_name: str
    file_path: str
    file_size: int
    file_hash: str
    category: str
    extension: str
    mime_type: str
    extracted_text: Optional[str] = ""
    subfolder: Optional[str] = ""
    topic: Optional[str] = ""
    clean_name: Optional[str] = ""
    tags: Optional[List[str]] = []
    created_at: str

class DuplicateGroupResponse(BaseModel):
    hash: str
    count: int
    file_size: int
    wasted_size: int
    files: List[FileItemResponse]

class CategoryStat(BaseModel):
    count: int
    size: int

class SubfolderStat(BaseModel):
    subfolder: str
    category: str
    count: int
    size: int

class StatsResponse(BaseModel):
    total_files: int
    total_size: int
    duplicate_files_count: int
    duplicate_wasted_size: int
    categories: Dict[str, CategoryStat]
    subfolders: Optional[List[SubfolderStat]] = []
    recent_files: List[FileItemResponse]

class SemanticSearchResult(BaseModel):
    file_id: str
    score: float
    metadata: Dict[str, Any]
    snippet: str

class CleanupDuplicatesRequest(BaseModel):
    keep_strategy: str = "keep_first"  # "keep_first" or "keep_latest"
    specific_file_ids: Optional[List[str]] = None
