import os
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient

# Ensure test DB is used during tests
os.environ["DB_PATH"] = "file_registry_test.db"
os.environ["SMTP_USER"] = "test-system@gmail.com"
os.environ["SMTP_PASSWORD"] = "testapppassword16"

from app.main import app
from app.database import (
    init_db,
    get_connection,
    create_user,
    get_user_by_email,
    get_login_challenge,
    get_session_by_token
)
from app.services.auth_service import hash_otp, hash_password
from app.services.email_service import EmailDeliveryError

client = TestClient(app)

def _clean_test_db():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM pending_registrations")
        cursor.execute("DELETE FROM email_verification_tokens")
        cursor.execute("DELETE FROM login_challenges")
        cursor.execute("DELETE FROM sessions")
        cursor.execute("DELETE FROM users WHERE email NOT IN ('admin@fileorganizer.ai', 'user@fileorganizer.ai')")
        conn.commit()

@pytest.fixture(autouse=True)
def setup_and_teardown():
    """Initialize clean database before and after each test."""
    init_db()
    _clean_test_db()
    yield
    _clean_test_db()

def helper_create_verified_user(email: str = "verified_user@example.com", password: str = "Password123!#", role: str = "user"):
    """Helper to seed a verified user for testing login."""
    pw_hash = hash_password(password)
    return create_user(email=email, password_hash=pw_hash, role=role, is_verified=1)

def test_successful_password_and_otp_login():
    """
    Test the complete 2FA login flow:
    1. Enter valid email and password -> returns challenge_id and status "otp_required"
    2. 6-digit OTP email is sent
    3. Submit valid OTP -> returns authenticated session token and user info
    4. Session token accesses protected routes
    """
    test_email = "tester1@example.com"
    test_password = "Password123!#"
    user = helper_create_verified_user(email=test_email, password=test_password)

    captured_otp = None

    def fake_send_otp_email(to_email, otp_code, user_role="user"):
        nonlocal captured_otp
        captured_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send_otp_email) as mock_send:
        # Step 1: Password authentication
        login_res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })

        assert login_res.status_code == 200
        data = login_res.json()
        assert data["status"] == "otp_required"
        assert "challenge_id" in data
        assert data["email"] == test_email
        assert data["expires_in"] == 300
        assert mock_send.called
        assert len(captured_otp) == 6
        assert captured_otp.isdigit()

        challenge_id = data["challenge_id"]

        # Verify challenge is stored in DB with salted hash
        challenge = get_login_challenge(challenge_id)
        assert challenge is not None
        assert challenge["user_id"] == user["id"]
        assert challenge["attempts"] == 0
        assert challenge["used_at"] is None
        assert challenge["otp_hash"] == hash_otp(challenge_id, captured_otp)

        # Step 2: OTP verification
        verify_res = client.post("/api/auth/verify-otp", json={
            "challenge_id": challenge_id,
            "otp": captured_otp
        })

        assert verify_res.status_code == 200
        auth_data = verify_res.json()
        assert "token" in auth_data
        assert auth_data["user"]["email"] == test_email
        assert auth_data["user"]["is_verified"] is True

        token = auth_data["token"]

        # Verify session is created and challenge is marked used
        updated_challenge = get_login_challenge(challenge_id)
        assert updated_challenge["used_at"] is not None

        session = get_session_by_token(token)
        assert session is not None
        assert session["user_id"] == user["id"]

        # Step 3: Access protected endpoint /api/auth/me with Bearer token
        me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        assert me_res.json()["email"] == test_email

def test_login_incorrect_password_does_not_send_otp():
    """Test that invalid password rejects immediately without dispatching OTP."""
    test_email = "tester2@example.com"
    test_password = "Password123!#"
    helper_create_verified_user(email=test_email, password=test_password)

    with patch("app.routes.auth.send_otp_email") as mock_send:
        res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": "WrongPassword999!"
        })

        assert res.status_code == 401
        assert res.json()["detail"] == "Invalid email or password."
        assert not mock_send.called

def test_login_nonexistent_email_no_enumeration():
    """Test that nonexistent email returns identical 401 message (no email enumeration)."""
    with patch("app.routes.auth.send_otp_email") as mock_send:
        res = client.post("/api/auth/login", json={
            "email": "ghost_nonexistent@example.com",
            "password": "Password123!#"
        })

        assert res.status_code == 401
        assert res.json()["detail"] == "Invalid email or password."
        assert not mock_send.called

def test_login_unverified_account_blocked():
    """Test that unverified account is strictly blocked from login and receiving OTP."""
    test_email = "unverified@example.com"
    test_password = "Password123!#"
    pw_hash = hash_password(test_password)
    create_user(email=test_email, password_hash=pw_hash, role="user", is_verified=0)

    with patch("app.routes.auth.send_otp_email") as mock_send:
        res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })

        assert res.status_code == 403
        assert "not been verified" in res.json()["detail"].lower()
        assert not mock_send.called

def test_admin_portal_role_restriction():
    """Test that regular users cannot initiate admin portal login."""
    test_email = "regular_user@example.com"
    test_password = "Password123!#"
    helper_create_verified_user(email=test_email, password=test_password, role="user")

    with patch("app.routes.auth.send_otp_email") as mock_send:
        res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password,
            "role": "admin"
        })

        assert res.status_code == 403
        assert "admin accounts only" in res.json()["detail"].lower()
        assert not mock_send.called

def test_verify_otp_incorrect_code():
    """Test submitting incorrect OTP returns 400 and counts remaining attempts."""
    test_email = "tester3@example.com"
    test_password = "Password123!#"
    helper_create_verified_user(email=test_email, password=test_password)

    with patch("app.routes.auth.send_otp_email"):
        login_res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        challenge_id = login_res.json()["challenge_id"]

    # Submit wrong OTP
    verify_res = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": "000000"
    })

    assert verify_res.status_code == 400
    assert "invalid verification code" in verify_res.json()["detail"].lower()
    assert "4 attempt(s) remaining" in verify_res.json()["detail"]

    # Challenge in DB should have attempts = 1
    challenge = get_login_challenge(challenge_id)
    assert challenge["attempts"] == 1
    assert challenge["used_at"] is None

def test_verify_otp_max_attempts_lockout():
    """Test that after 5 failed OTP attempts, the challenge is locked."""
    test_email = "tester4@example.com"
    test_password = "Password123!#"
    helper_create_verified_user(email=test_email, password=test_password)

    captured_otp = None
    def fake_send(to_email, otp_code, user_role="user"):
        nonlocal captured_otp
        captured_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send):
        login_res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        challenge_id = login_res.json()["challenge_id"]

    # Fail 4 times (attempts 1 to 4)
    for _ in range(4):
        res = client.post("/api/auth/verify-otp", json={
            "challenge_id": challenge_id,
            "otp": "999999"
        })
        assert res.status_code == 400

    # 5th failed attempt should trigger 429 lockout
    res5 = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": "999999"
    })
    assert res5.status_code == 429
    assert "too many incorrect attempts" in res5.json()["detail"].lower()

    # Even submitting the correct OTP now fails
    res_valid = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": captured_otp
    })
    assert res_valid.status_code == 429
    assert "locked" in res_valid.json()["detail"].lower()

def test_verify_otp_expired():
    """Test that expired OTP (> 5 minutes) is rejected."""
    test_email = "tester5@example.com"
    test_password = "Password123!#"
    helper_create_verified_user(email=test_email, password=test_password)

    captured_otp = None
    def fake_send(to_email, otp_code, user_role="user"):
        nonlocal captured_otp
        captured_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send):
        login_res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        challenge_id = login_res.json()["challenge_id"]

    # Expire challenge in database
    past_date = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE login_challenges SET expires_at = ? WHERE challenge_id = ?", (past_date, challenge_id))
        conn.commit()

    res = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": captured_otp
    })
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()

def test_verify_otp_single_use_reuse_rejected():
    """Test that OTP cannot be reused once validated."""
    test_email = "tester6@example.com"
    test_password = "Password123!#"
    helper_create_verified_user(email=test_email, password=test_password)

    captured_otp = None
    def fake_send(to_email, otp_code, user_role="user"):
        nonlocal captured_otp
        captured_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send):
        login_res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        challenge_id = login_res.json()["challenge_id"]

    # First verification succeeds
    res1 = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": captured_otp
    })
    assert res1.status_code == 200

    # Second verification with same code fails
    res2 = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": captured_otp
    })
    assert res2.status_code == 400
    assert "already been used" in res2.json()["detail"].lower()

def test_resend_otp_cooldown_rate_limit():
    """Test that resend OTP enforces 60-second cooldown."""
    test_email = "tester7@example.com"
    test_password = "Password123!#"
    helper_create_verified_user(email=test_email, password=test_password)

    with patch("app.routes.auth.send_otp_email"):
        login_res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        challenge_id = login_res.json()["challenge_id"]

    # Immediate resend should be blocked by 60s cooldown
    resend_res = client.post("/api/auth/resend-otp", json={
        "challenge_id": challenge_id
    })
    assert resend_res.status_code == 429
    assert "please wait" in resend_res.json()["detail"].lower()

def test_resend_otp_success_after_cooldown():
    """Test that resending OTP after cooldown invalidates previous code and sends new code."""
    test_email = "tester8@example.com"
    test_password = "Password123!#"
    helper_create_verified_user(email=test_email, password=test_password)

    first_otp = None
    second_otp = None

    def fake_send_1(to_email, otp_code, user_role="user"):
        nonlocal first_otp
        first_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send_1):
        login_res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        challenge_id = login_res.json()["challenge_id"]

    # Simulate 65 seconds passed
    past_sent = (datetime.utcnow() - timedelta(seconds=65)).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE login_challenges SET last_sent_at = ? WHERE challenge_id = ?", (past_sent, challenge_id))
        conn.commit()

    def fake_send_2(to_email, otp_code, user_role="user"):
        nonlocal second_otp
        second_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send_2):
        resend_res = client.post("/api/auth/resend-otp", json={
            "challenge_id": challenge_id
        })
        assert resend_res.status_code == 200
        assert resend_res.json()["success"] is True

    assert second_otp is not None
    # Old OTP should now fail
    fail_res = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": first_otp
    })
    assert fail_res.status_code == 400

    # New OTP should succeed
    succ_res = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": second_otp
    })
    assert succ_res.status_code == 200
    assert "token" in succ_res.json()

def test_email_delivery_failure_on_login():
    """Test that SMTP failure during login fails safely and marks challenge used."""
    test_email = "tester9@example.com"
    test_password = "Password123!#"
    helper_create_verified_user(email=test_email, password=test_password)

    with patch("app.routes.auth.send_otp_email", side_effect=EmailDeliveryError("SMTP connection timed out")):
        res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        assert res.status_code == 500
        assert "failed to deliver login verification code" in res.json()["detail"].lower()

    # Check that any challenge created was marked used/invalidated
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM login_challenges")
        challenges = cursor.fetchall()
        for ch in challenges:
            assert ch["used_at"] is not None

def test_protected_endpoints_require_otp_session_token():
    """Test that protected endpoints reject unauthorized requests without valid session."""
    # 1. No token
    res1 = client.get("/api/auth/me")
    assert res1.status_code == 401
    assert "authentication required" in res1.json()["detail"].lower()

    # 2. Fake / expired token
    res2 = client.get("/api/auth/me", headers={"Authorization": "Bearer fake_token_12345"})
    assert res2.status_code == 401
    assert "invalid or expired" in res2.json()["detail"].lower()

    # 3. Settings endpoint protected
    res3 = client.post("/api/settings/clear-all")
    assert res3.status_code == 401

def test_logout_revokes_session():
    """Test that logging out invalidates session token immediately."""
    test_email = "tester10@example.com"
    test_password = "Password123!#"
    helper_create_verified_user(email=test_email, password=test_password)

    captured_otp = None
    def fake_send(to_email, otp_code, user_role="user"):
        nonlocal captured_otp
        captured_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send):
        login_res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        challenge_id = login_res.json()["challenge_id"]

    verify_res = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": captured_otp
    })
    token = verify_res.json()["token"]

    # Verify token works
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200

    # Logout
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True

    # Token is now invalid
    me_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_after.status_code == 401
