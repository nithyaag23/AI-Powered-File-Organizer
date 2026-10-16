from fastapi import APIRouter
from ..database import get_stats

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("")
def read_stats():
    return get_stats()
