import uuid
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, HTTPException, status
from typing import Optional, List

from ..services.auth_service import validate_password, hash_password, verify_password
from ..database import get_user_by_email, create_user, list_users

router = APIRouter(prefix="/api/auth", tags=["auth"])

class AuthRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = "user"

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserResponse
    message: str

@router.post("/register", response_model=AuthResponse)
def register(payload: AuthRequest):
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required."
        )

    # Enforce 4 password requirements
    is_valid, msg = validate_password(payload.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    # Check if user already exists
    existing = get_user_by_email(email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please log in."
        )

    # Hash and save
    pw_hash = hash_password(payload.password)
    role = "admin" if payload.role and payload.role.lower() == "admin" else "user"
    user_record = create_user(email=email, password_hash=pw_hash, role=role)

    # Generate session token
    token = f"tok_{uuid.uuid4().hex}"

    return {
        "token": token,
        "user": user_record,
        "message": f"Successfully registered as {role.upper()}."
    }

@router.post("/login", response_model=AuthResponse)
def login(payload: AuthRequest):
    email = payload.email.strip().lower()
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    token = f"tok_{uuid.uuid4().hex}"

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "created_at": user["created_at"]
        },
        "message": f"Welcome back, {user['email']}!"
    }

@router.get("/users")
def get_users():
    return list_users()
