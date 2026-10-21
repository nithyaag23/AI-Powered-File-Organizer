import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status, Query, Depends
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials

from ..config import (
    FRONTEND_URL,
    VERIFICATION_TOKEN_EXPIRE_HOURS,
    RESEND_RATE_LIMIT_SECONDS
)
from ..services.auth_service import (
    validate_password,
    hash_password,
    verify_password,
    generate_verification_token,
    hash_token,
    generate_otp,
    hash_otp,
    generate_challenge_id,
    get_current_user,
    security
)
from ..services.email_service import (
    send_verification_email,
    send_otp_email,
    EmailDeliveryError,
    EmailConfigurationError
)
from ..database import (
    get_user_by_email,
    get_user_by_id,
    create_user,
    delete_user,
    set_user_verified,
    update_last_verification_sent,
    create_verification_token,
    get_verification_token_by_hash,
    mark_verification_token_used,
    invalidate_user_verification_tokens,
    create_or_update_pending_registration,
    get_pending_registration_by_token,
    get_pending_registration_by_email,
    get_pending_registration_by_id,
    increment_pending_registration_attempts,
    update_pending_registration_otp,
    update_pending_registration_token,
    delete_pending_registration,
    create_login_challenge,
    get_login_challenge,
    increment_challenge_attempts,
    update_login_challenge_otp,
    mark_challenge_used,
    invalidate_user_login_challenges,
    create_session,
    delete_session_by_token,
    list_users
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

class AuthRequest(BaseModel):
    email: str
    password: str
    role: Optional[str] = "user"

class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    is_verified: bool
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserResponse
    message: str

class RegisterResponse(BaseModel):
    status: str
    message: str
    email: str
    role: str
    challenge_id: Optional[str] = None
    expires_in: Optional[int] = 300

class LoginChallengeResponse(BaseModel):
    status: str = "otp_required"
    challenge_id: str
    email: str
    message: str
    expires_in: int = 300

class VerifyOtpRequest(BaseModel):
    challenge_id: str
    otp: str

class ResendOtpRequest(BaseModel):
    challenge_id: str

class ResendOtpResponse(BaseModel):
    success: bool
    challenge_id: str
    message: str
    expires_in: int = 300

class VerifyEmailRequest(BaseModel):
    token: str

class VerifyEmailResponse(BaseModel):
    success: bool
    message: str
    email: Optional[str] = None

class ResendVerificationRequest(BaseModel):
    email: str

class ResendVerificationResponse(BaseModel):
    success: bool
    message: str

@router.post("/register", response_model=RegisterResponse)
def register(payload: AuthRequest):
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required."
        )

    # Enforce password requirements (10 chars, uppercase, lowercase, digit, special char)
    is_valid, msg = validate_password(payload.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )

    # Check if user already exists in the users database
    existing = get_user_by_email(email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please log in."
        )

    # Hash password and prepare role
    pw_hash = hash_password(payload.password)
    role = "admin" if payload.role and payload.role.lower() == "admin" else "user"

    # Generate single-use, expiring verification token & 6-digit OTP
    raw_token, token_hash = generate_verification_token()
    raw_otp = generate_otp()
    expires_at = (datetime.utcnow() + timedelta(minutes=5)).isoformat()

    # Stage in pending_registrations. The users table is NEVER touched until verification succeeds!
    # If a prior unverified attempt existed, it is cleanly overwritten with a fresh code.
    staged = create_or_update_pending_registration(
        email=email,
        password_hash=pw_hash,
        role=role,
        otp_hash="temp",
        token_hash=token_hash,
        expires_at_iso=expires_at
    )
    challenge_id = staged["id"]
    otp_hash = hash_otp(challenge_id, raw_otp)
    update_pending_registration_otp(
        record_id=challenge_id,
        new_otp_hash=otp_hash,
        new_token_hash=token_hash,
        new_expires_at=expires_at,
        now_iso=datetime.utcnow().isoformat()
    )

    # Send 6-digit OTP code to user's registered email via Gmail SMTP (STARTTLS)
    try:
        send_otp_email(to_email=email, otp_code=raw_otp, user_role=role)
    except Exception as e:
        # Roll back staged pending registration so user can retry safely
        delete_pending_registration(email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send verification code email: {str(e)}. Please check your connection and try again."
        )

    return {
        "status": "otp_required",
        "challenge_id": challenge_id,
        "email": email,
        "role": role,
        "message": "A 6-digit verification code has been sent to your email. Enter it below to complete creating your account.",
        "expires_in": 300
    }

@router.post("/login", response_model=LoginChallengeResponse)
def login(payload: AuthRequest):
    """
    Step 1 of 2FA:
    Verifies user password securely.
    If valid, dispatches a 6-digit OTP to the registered email address and returns a short-lived login challenge.
    Does NOT issue full access tokens until OTP is verified.
    """
    email = payload.email.strip().lower()
    user = get_user_by_email(email)

    # Prevent email enumeration: timing-safe dummy password check if user not found
    if not user:
        pending = get_pending_registration_by_email(email)
        if pending:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your email address has not been verified yet. Please check your inbox for the verification link to complete creating your account."
            )
        verify_password("DummyPassword123#", "$dummy$hash")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Require email verification before login
    if not user.get("is_verified", 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your email address has not been verified. Please check your inbox or request a new verification link."
        )

    # Check administrator portal access restriction
    if payload.role and payload.role.lower() == "admin" and user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This sign-in accepts Admin accounts only. Access refused with AUTH_FORBIDDEN."
        )

    # Invalidate previous login challenges for this user
    invalidate_user_login_challenges(user["id"])

    # Generate 6-digit OTP and secure challenge
    challenge_id = generate_challenge_id()
    raw_otp = generate_otp()
    otp_hash = hash_otp(challenge_id, raw_otp)
    expires_at = (datetime.utcnow() + timedelta(minutes=5)).isoformat()

    create_login_challenge(
        user_id=user["id"],
        challenge_id=challenge_id,
        otp_hash=otp_hash,
        expires_at_iso=expires_at
    )

    # Send OTP to user's registered email
    try:
        send_otp_email(to_email=user["email"], otp_code=raw_otp, user_role=user["role"])
    except Exception as e:
        mark_challenge_used(challenge_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deliver login verification code email: {str(e)}. Please check your connection and try again."
        )

    return {
        "status": "otp_required",
        "challenge_id": challenge_id,
        "email": user["email"],
        "message": "A 6-digit login verification code has been sent to your registered email address.",
        "expires_in": 300
    }

@router.post("/verify-otp", response_model=AuthResponse)
def verify_otp(payload: VerifyOtpRequest):
    """
    Verifies 6-digit OTP for:
    1) Account creation & email verification
    2) Login Two-Factor Authentication
    """
    challenge_id = payload.challenge_id.strip()
    submitted_otp = payload.otp.strip()

    if not challenge_id or not submitted_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge ID and 6-digit verification code are required."
        )

    # --------------------------------------------------------------------------
    # Path A: Registration OTP Verification (Creates the account in DB!)
    # --------------------------------------------------------------------------
    if challenge_id.startswith("reg_"):
        pending = get_pending_registration_by_id(challenge_id)
        if not pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration session not found or expired. Please sign up again."
            )

        if pending.get("attempts", 0) >= 5:
            delete_pending_registration(pending["email"])
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many incorrect attempts. For security, this registration session has been locked. Please sign up again."
            )

        try:
            expires_at = datetime.fromisoformat(pending["expires_at"])
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed challenge expiration date."
            )

        if datetime.utcnow() > expires_at:
            delete_pending_registration(pending["email"])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired. Please sign up again to receive a new code."
            )

        expected_hash = hash_otp(challenge_id, submitted_otp)
        if not secrets.compare_digest(pending["otp_hash"], expected_hash):
            attempts = increment_pending_registration_attempts(challenge_id)
            remaining = max(0, 5 - attempts)
            if remaining == 0:
                delete_pending_registration(pending["email"])
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many incorrect attempts. For security, this registration session has been locked. Please sign up again."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid verification code. {remaining} attempt(s) remaining."
            )

        # OTP verified! NOW AND ONLY NOW insert user into the users table!
        new_user = create_user(
            email=pending["email"],
            password_hash=pending["password_hash"],
            role=pending["role"],
            is_verified=1
        )
        delete_pending_registration(pending["email"])

        # Create authenticated session token (valid 7 days)
        session_token = f"tok_{uuid.uuid4().hex}"
        session_expires = (datetime.utcnow() + timedelta(days=7)).isoformat()
        create_session(new_user["id"], session_token, session_expires)

        return {
            "token": session_token,
            "user": {
                "id": new_user["id"],
                "email": new_user["email"],
                "role": new_user["role"],
                "is_verified": True,
                "created_at": new_user["created_at"]
            },
            "message": f"Account created and verified successfully! Welcome, {new_user['email']}!"
        }

    # --------------------------------------------------------------------------
    # Path B: Login 2FA OTP Verification
    # --------------------------------------------------------------------------
    challenge = get_login_challenge(challenge_id)
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired login session. Please sign in again."
        )

    # Check if single-use challenge was already consumed
    if challenge.get("used_at"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This login verification code has already been used. Please sign in again."
        )

    # Check 5-minute expiration
    try:
        expires_at = datetime.fromisoformat(challenge["expires_at"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed challenge expiration date."
        )

    if datetime.utcnow() > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Login verification code has expired. Please request a new code or sign in again."
        )

    # Check rate limit on incorrect submissions (max 5 attempts)
    if challenge.get("attempts", 0) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. For security, this login session has been locked. Please sign in again."
        )

    # Compare hashed OTP
    expected_hash = challenge["otp_hash"]
    computed_hash = hash_otp(challenge_id, submitted_otp)

    if computed_hash != expected_hash:
        new_attempts = increment_challenge_attempts(challenge_id)
        remaining = max(0, 5 - new_attempts)
        if remaining == 0:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many incorrect attempts. For security, this login session has been locked. Please sign in again."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining} attempt(s) remaining."
        )

    # OTP is valid! Mark challenge used and invalidate user challenges
    mark_challenge_used(challenge_id)
    invalidate_user_login_challenges(challenge["user_id"])

    user = get_user_by_id(challenge["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this login challenge was not found."
        )

    # Issue authenticated session token (valid for 7 days)
    session_token = f"tok_{uuid.uuid4().hex}"
    session_expires = (datetime.utcnow() + timedelta(days=7)).isoformat()
    create_session(user["id"], session_token, session_expires)

    return {
        "token": session_token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "role": user["role"],
            "is_verified": bool(user.get("is_verified", 0)),
            "created_at": user["created_at"]
        },
        "message": f"Welcome back, {user['email']}!"
    }

@router.post("/resend-otp", response_model=ResendOtpResponse)
def resend_otp(payload: ResendOtpRequest):
    """
    Resends a fresh 6-digit OTP for an existing active registration or login challenge.
    Enforces a 60-second cooldown rate limit.
    """
    challenge_id = payload.challenge_id.strip()

    # 1. Registration Challenge Resend
    if challenge_id.startswith("reg_"):
        pending = get_pending_registration_by_id(challenge_id)
        if not pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration session not found or expired. Please sign up again."
            )

        # Enforce 60-second cooldown rate limit
        if pending.get("last_sent_at"):
            try:
                last_sent = datetime.fromisoformat(pending["last_sent_at"])
                elapsed = (datetime.utcnow() - last_sent).total_seconds()
                if elapsed < 60:
                    wait_seconds = int(60 - elapsed)
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=f"Please wait {wait_seconds} seconds before requesting a new verification code."
                    )
            except HTTPException:
                raise
            except Exception:
                pass

        raw_otp = generate_otp()
        new_otp_hash = hash_otp(challenge_id, raw_otp)
        new_expires_at = (datetime.utcnow() + timedelta(minutes=5)).isoformat()
        now_iso = datetime.utcnow().isoformat()

        update_pending_registration_otp(
            record_id=challenge_id,
            new_otp_hash=new_otp_hash,
            new_token_hash=pending.get("token_hash", ""),
            new_expires_at=new_expires_at,
            now_iso=now_iso
        )

        try:
            send_otp_email(to_email=pending["email"], otp_code=raw_otp, user_role=pending["role"])
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to resend verification code: {str(e)}. Please check your connection."
            )

        return {
            "success": True,
            "challenge_id": challenge_id,
            "message": "A new verification code has been sent to your email.",
            "expires_in": 300
        }

    # 2. Login Challenge Resend
    challenge = get_login_challenge(challenge_id)
    if not challenge or challenge.get("used_at"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired login session. Please sign in again."
        )

    # Enforce 60-second cooldown rate limit
    if challenge.get("last_sent_at"):
        try:
            last_sent = datetime.fromisoformat(challenge["last_sent_at"])
            elapsed = (datetime.utcnow() - last_sent).total_seconds()
            if elapsed < 60:
                wait_seconds = int(60 - elapsed)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {wait_seconds} seconds before requesting a new login code."
                )
        except HTTPException:
            raise
        except Exception:
            pass

    user = get_user_by_id(challenge["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )

    # Generate new OTP and update challenge record
    raw_otp = generate_otp()
    new_otp_hash = hash_otp(challenge_id, raw_otp)
    new_expires_at = (datetime.utcnow() + timedelta(minutes=5)).isoformat()
    now_iso = datetime.utcnow().isoformat()

    update_login_challenge_otp(challenge_id, new_otp_hash, new_expires_at, now_iso)

    # Deliver new OTP via Gmail SMTP
    try:
        send_otp_email(to_email=user["email"], otp_code=raw_otp, user_role=user["role"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resend verification code: {str(e)}. Please check your connection."
        )

    return {
        "success": True,
        "challenge_id": challenge_id,
        "message": "A new verification code has been sent to your email.",
        "expires_in": 300
    }

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Protected endpoint: returns authenticated user profile.
    Requires Bearer token from successful password + OTP verification.
    """
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "role": current_user["role"],
        "is_verified": bool(current_user.get("is_verified", 0)),
        "created_at": current_user["created_at"]
    }

@router.post("/logout")
def logout(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """
    Terminates the active session token in the database.
    """
    if credentials and credentials.credentials:
        delete_session_by_token(credentials.credentials)
    return {"success": True, "message": "Successfully logged out."}

@router.post("/verify-email", response_model=VerifyEmailResponse)
def verify_email_post(payload: VerifyEmailRequest):
    clean_token = payload.token.strip()
    if not clean_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token is required."
        )

    token_hash = hash_token(clean_token)

    # 1. Primary path: Pending staged registrations (Account created ONLY upon verification!)
    pending = get_pending_registration_by_token(token_hash)
    if pending:
        try:
            expires_at = datetime.fromisoformat(pending["expires_at"])
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed token expiration date."
            )

        if datetime.utcnow() > expires_at:
            delete_pending_registration(pending["email"])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This verification link has expired. Please register again to receive a fresh verification link."
            )

        # Check if already registered in users
        existing_user = get_user_by_email(pending["email"])
        if existing_user:
            delete_pending_registration(pending["email"])
            return {
                "success": True,
                "message": "Account has already been created and verified! You may log in directly.",
                "email": pending["email"]
            }

        # NOW AND ONLY NOW: Insert user into the users database!
        new_user = create_user(
            email=pending["email"],
            password_hash=pending["password_hash"],
            role=pending["role"],
            is_verified=1
        )
        # Record token in email_verification_tokens as used to prevent replay
        tok = create_verification_token(new_user["id"], token_hash, pending["expires_at"])
        mark_verification_token_used(tok["id"])

        delete_pending_registration(pending["email"])

        return {
            "success": True,
            "message": "Email address successfully verified! Your account is now created and you may log in.",
            "email": new_user["email"]
        }

    # 2. Backwards-compatibility path for legacy verification tokens
    token_record = get_verification_token_by_hash(token_hash)
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or non-existent verification link."
        )

    if token_record["used_at"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link has already been used. Please log in directly."
        )

    try:
        expires_at = datetime.fromisoformat(token_record["expires_at"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed token expiration date."
        )

    if datetime.utcnow() > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link has expired. Please request a new verification email."
        )

    user = get_user_by_id(token_record["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this token was not found."
        )

    mark_verification_token_used(token_record["id"])
    set_user_verified(user["id"])
    invalidate_user_verification_tokens(user["id"])

    return {
        "success": True,
        "message": "Email address successfully verified! Your account is now active and you may log in.",
        "email": user["email"]
    }

@router.get("/verify-email")
def verify_email_get(token: str = Query(..., description="The raw verification token")):
    redirect_target = f"{FRONTEND_URL}/#/verify-email?token={token}"
    return RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)

@router.post("/resend-verification", response_model=ResendVerificationResponse)
def resend_verification(payload: ResendVerificationRequest):
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid email address is required."
        )

    user = get_user_by_email(email)
    if user and user.get("is_verified", 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is already verified. You can log in directly."
        )

    pending = get_pending_registration_by_email(email)
    if not pending and not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account or pending registration found with this email address. Please register first."
        )

    last_sent_str = pending.get("last_sent_at") if pending else user.get("last_verification_sent_at")
    if last_sent_str:
        try:
            last_sent = datetime.fromisoformat(last_sent_str)
            elapsed = (datetime.utcnow() - last_sent).total_seconds()
            if elapsed < RESEND_RATE_LIMIT_SECONDS:
                wait_seconds = int(RESEND_RATE_LIMIT_SECONDS - elapsed)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {wait_seconds} seconds before requesting another verification email."
                )
        except HTTPException:
            raise
        except Exception:
            pass

    raw_token, token_hash = generate_verification_token()
    expires_at = (datetime.utcnow() + timedelta(hours=VERIFICATION_TOKEN_EXPIRE_HOURS)).isoformat()

    if pending:
        update_pending_registration_token(email, token_hash, expires_at)
        role = pending["role"]
    else:
        invalidate_user_verification_tokens(user["id"])
        create_verification_token(user["id"], token_hash, expires_at)
        update_last_verification_sent(user["id"], datetime.utcnow().isoformat())
        role = user["role"]

    verification_url = f"{FRONTEND_URL}/#/verify-email?token={raw_token}"

    try:
        send_verification_email(to_email=email, verification_url=verification_url, user_role=role)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send verification email: {str(e)}. Please verify your SMTP settings."
        )

    return {
        "success": True,
        "message": "A new verification email has been sent. Please check your inbox."
    }

@router.get("/users")
def get_users(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Protected endpoint: only accessible to authenticated users (and admin).
    """
    return list_users()
