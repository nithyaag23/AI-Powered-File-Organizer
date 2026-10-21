import os
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient

# Ensure test DB is used during tests to not affect production registry
os.environ["DB_PATH"] = "file_registry_test.db"
os.environ["SMTP_USER"] = "test-system@gmail.com"
os.environ["SMTP_PASSWORD"] = "testapppassword16"

from app.main import app
from app.database import (
    init_db,
    get_connection,
    get_user_by_email,
    get_pending_registration_by_email,
    get_pending_registration_by_id
)
from app.services.auth_service import hash_otp
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

def test_registration_sends_otp_and_does_not_touch_users_table():
    """
    Test registration stages pending request and dispatches a 6-digit OTP.
    Crucial fix: The users table is NEVER modified or updated until OTP is verified!
    """
    test_email = "alice@example.com"
    test_password = "Password123!#"
    captured_otp = None

    def fake_send(to_email, otp_code, user_role="user"):
        nonlocal captured_otp
        captured_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send) as mock_send:
        res = client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })

        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "otp_required"
        assert "challenge_id" in data
        assert mock_send.called
        assert captured_otp is not None
        assert len(captured_otp) == 6

        # User MUST NOT exist in users table!
        user = get_user_by_email(test_email)
        assert user is None

        # Pending challenge MUST exist in pending_registrations
        pending = get_pending_registration_by_id(data["challenge_id"])
        assert pending is not None
        assert pending["email"] == test_email
        assert pending["otp_hash"] == hash_otp(data["challenge_id"], captured_otp)

def test_login_blocked_before_verification():
    """Test that users who have not completed OTP verification cannot log in."""
    test_email = "bob@example.com"
    test_password = "Password123!#"

    with patch("app.routes.auth.send_otp_email"):
        client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })

    # Attempt to log in before verifying OTP
    res = client.post("/api/auth/login", json={
        "email": test_email,
        "password": test_password
    })

    assert res.status_code == 403
    assert "not been verified" in res.json()["detail"].lower()

def test_successful_registration_otp_creates_user():
    """Test that valid OTP confirms registration, creates account in users table, and issues session."""
    test_email = "charlie@example.com"
    test_password = "Password123!#"
    captured_otp = None

    def fake_send(to_email, otp_code, user_role="user"):
        nonlocal captured_otp
        captured_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send):
        reg_res = client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })
        challenge_id = reg_res.json()["challenge_id"]

    # Verify that users table is STILL empty for charlie
    assert get_user_by_email(test_email) is None

    # Submit the 6-digit OTP to verify registration
    verify_res = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": captured_otp
    })
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert "token" in data
    assert data["user"]["email"] == test_email
    assert data["user"]["is_verified"] is True

    # NOW AND ONLY NOW: user exists in users table!
    user = get_user_by_email(test_email)
    assert user is not None
    assert user["is_verified"] == 1

def test_invalid_registration_otp():
    """Test that submitting an incorrect OTP code fails and tracks remaining attempts."""
    test_email = "dave@example.com"
    test_password = "Password123!#"

    with patch("app.routes.auth.send_otp_email"):
        reg_res = client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })
        challenge_id = reg_res.json()["challenge_id"]

    # Submit wrong OTP
    res = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": "000000"
    })
    assert res.status_code == 400
    assert "invalid verification code" in res.json()["detail"].lower()

    # User remains uncreated in database
    assert get_user_by_email(test_email) is None

def test_expired_registration_otp():
    """Test that expired registration OTP fails and removes pending record."""
    test_email = "eve@example.com"
    test_password = "Password123!#"
    captured_otp = None

    def fake_send(to_email, otp_code, user_role="user"):
        nonlocal captured_otp
        captured_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send):
        reg_res = client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })
        challenge_id = reg_res.json()["challenge_id"]

    # Artificially expire the registration in database
    past_date = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE pending_registrations SET expires_at = ? WHERE id = ?", (past_date, challenge_id))
        conn.commit()

    res = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": captured_otp
    })
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()

    # User remains uncreated in database
    assert get_user_by_email(test_email) is None

def test_single_use_registration_otp():
    """Test that registration OTP cannot be reused once validated."""
    test_email = "frank@example.com"
    test_password = "Password123!#"
    captured_otp = None

    def fake_send(to_email, otp_code, user_role="user"):
        nonlocal captured_otp
        captured_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send):
        reg_res = client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })
        challenge_id = reg_res.json()["challenge_id"]

    # First verification succeeds
    res1 = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": captured_otp
    })
    assert res1.status_code == 200

    # Second attempt with same challenge fails
    res2 = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id,
        "otp": captured_otp
    })
    assert res2.status_code == 400

def test_duplicate_registration_verified_user():
    """Test that registering an already registered verified email fails."""
    test_email = "george@example.com"
    test_password = "Password123!#"
    captured_otp = None

    def fake_send(to_email, otp_code, user_role="user"):
        nonlocal captured_otp
        captured_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send):
        reg_res = client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })
        client.post("/api/auth/verify-otp", json={
            "challenge_id": reg_res.json()["challenge_id"],
            "otp": captured_otp
        })

    # Try registering again with same email
    with patch("app.routes.auth.send_otp_email"):
        res = client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })
        assert res.status_code == 400
        assert "already exists" in res.json()["detail"].lower()

def test_duplicate_registration_unverified_replaces_cleanly():
    """
    Test that re-registering an unverified email DOES NOT block the user.
    It cleanly updates the pending challenge with a fresh OTP code!
    """
    test_email = "helen@example.com"
    test_password = "Password123!#"
    first_otp = None
    second_otp = None

    def fake_send_1(to_email, otp_code, user_role="user"):
        nonlocal first_otp
        first_otp = otp_code

    with patch("app.routes.auth.send_otp_email", side_effect=fake_send_1):
        res1 = client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })
        assert res1.status_code == 200
        challenge_id1 = res1.json()["challenge_id"]

    def fake_send_2(to_email, otp_code, user_role="user"):
        nonlocal second_otp
        second_otp = otp_code

    # User re-registers with same email (e.g. made a typo or requested new OTP)
    with patch("app.routes.auth.send_otp_email", side_effect=fake_send_2):
        res2 = client.post("/api/auth/register", json={
            "email": test_email,
            "password": "NewPassword123!#",
            "role": "user"
        })
        assert res2.status_code == 200
        challenge_id2 = res2.json()["challenge_id"]

    # Old OTP should no longer work
    fail_res = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id1,
        "otp": first_otp
    })
    assert fail_res.status_code == 400

    # New OTP should succeed and create the user!
    succ_res = client.post("/api/auth/verify-otp", json={
        "challenge_id": challenge_id2,
        "otp": second_otp
    })
    assert succ_res.status_code == 200
    assert get_user_by_email(test_email) is not None

def test_email_delivery_failure_rolls_back_user():
    """Test that SMTP delivery failure rolls back pending registration and leaves users table untouched."""
    test_email = "failuser@example.com"
    test_password = "Password123!#"

    with patch("app.routes.auth.send_otp_email", side_effect=EmailDeliveryError("SMTP connection timed out")):
        res = client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })
        assert res.status_code == 500
        assert "failed to send verification code email" in res.json()["detail"].lower()

    # Users table is untouched
    assert get_user_by_email(test_email) is None
    # Pending table is untouched
    assert get_pending_registration_by_email(test_email) is None

def test_resend_registration_otp_and_cooldown():
    """Test resending registration OTP code and enforcing 60s cooldown."""
    test_email = "ian@example.com"
    test_password = "Password123!#"

    with patch("app.routes.auth.send_otp_email"):
        reg_res = client.post("/api/auth/register", json={
            "email": test_email,
            "password": test_password,
            "role": "user"
        })
        challenge_id = reg_res.json()["challenge_id"]

    # Immediate resend hits 60s cooldown
    resend1 = client.post("/api/auth/resend-otp", json={"challenge_id": challenge_id})
    assert resend1.status_code == 429
    assert "please wait" in resend1.json()["detail"].lower()

    # Simulate 65 seconds passed
    past_time = (datetime.utcnow() - timedelta(seconds=65)).isoformat()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE pending_registrations SET last_sent_at = ? WHERE id = ?", (past_time, challenge_id))
        conn.commit()

    # Resend now succeeds
    with patch("app.routes.auth.send_otp_email") as mock_resend:
        resend2 = client.post("/api/auth/resend-otp", json={"challenge_id": challenge_id})
        assert resend2.status_code == 200
        assert resend2.json()["success"] is True
        assert mock_resend.called
