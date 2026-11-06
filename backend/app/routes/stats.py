from fastapi import APIRouter
from ..database import get_stats

from fastapi import Depends
from ..services.auth_service import get_current_user

router = APIRouter(prefix="/api/stats", tags=["stats"], dependencies=[Depends(get_current_user)])

@router.get("")
def read_stats():
    return get_stats()
