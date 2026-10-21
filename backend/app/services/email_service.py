import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

from ..config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME,
    VERIFICATION_TOKEN_EXPIRE_HOURS
)

class EmailConfigurationError(Exception):
    """Raised when SMTP credentials or settings are missing."""
    pass

class EmailDeliveryError(Exception):
    """Raised when email delivery fails via SMTP."""
    pass

def _get_smtp_credentials():
    clean_user = SMTP_USER.strip() if SMTP_USER else ""
    raw_password = SMTP_PASSWORD.strip() if SMTP_PASSWORD else ""
    clean_password = raw_password.replace(" ", "")

    if not clean_user or not clean_password:
        raise EmailConfigurationError(
            "SMTP credentials not configured. Please set SMTP_USER and SMTP_PASSWORD in your .env file."
        )
    sender_email = SMTP_FROM_EMAIL.strip() if SMTP_FROM_EMAIL else clean_user
    sender_name = SMTP_FROM_NAME.strip() if SMTP_FROM_NAME else "FileOrganizer AI"
    return clean_user, clean_password, sender_email, sender_name

def send_verification_email(to_email: str, verification_url: str, user_role: str = "user") -> None:
    """
    Send an email verification message with a secure link via Gmail SMTP.
    Uses Python's built-in smtplib with STARTTLS on port 587.
    """
    clean_user, clean_password, sender_email, sender_name = _get_smtp_credentials()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your email address - FileOrganizer AI"
    msg["From"] = formataddr((sender_name, sender_email))
    msg["To"] = to_email

    text_content = f"""Hello,

Thank you for registering with FileOrganizer AI.

Please verify your email address to activate your account by visiting the following link:
{verification_url}

This verification link is single-use and will expire in {VERIFICATION_TOKEN_EXPIRE_HOURS} hours.

If you did not create an account with FileOrganizer AI, please ignore this email.

Best regards,
The FileOrganizer AI Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #0f2952; padding: 32px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">FileOrganizer.ai</h1>
              <p style="color: #93c5fd; margin: 6px 0 0 0; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">AI-Powered Local File Management</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Confirm your email address</h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                Welcome to FileOrganizer AI! Please click the button below to verify your email address (<strong>{to_email}</strong>) and activate your account.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #0f2952;">
                    <a href="{verification_url}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      Verify Email Address &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color: #f8fafc; border-left: 4px solid #0f2952; padding: 12px 16px; border-radius: 6px; margin: 24px 0 20px 0;">
                <p style="color: #334155; font-size: 12px; line-height: 1.5; margin: 0;">
                  <strong>Security Note:</strong> This link is single-use and expires in <strong>{VERIFICATION_TOKEN_EXPIRE_HOURS} hours</strong>.
                </p>
              </div>
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 24px 0 6px 0;">
                If the button doesn't work, copy and paste this link:
              </p>
              <p style="margin: 0; word-break: break-all;">
                <a href="{verification_url}" style="color: #2563eb; font-size: 12px; text-decoration: underline;">{verification_url}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #94a3b8; font-size: 11px; line-height: 1.5; margin: 0;">
                If you did not register for an account with FileOrganizer AI, please ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    part_text = MIMEText(text_content, "plain", "utf-8")
    part_html = MIMEText(html_content, "html", "utf-8")
    msg.attach(part_text)
    msg.attach(part_html)

    _deliver_email(clean_user, clean_password, msg)

def send_otp_email(to_email: str, otp_code: str, user_role: str = "user") -> None:
    """
    Send a 6-digit login verification OTP via Gmail SMTP.
    OTP expires in 5 minutes and is single-use.
    """
    clean_user, clean_password, sender_email, sender_name = _get_smtp_credentials()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{otp_code} is your FileOrganizer AI login code"
    msg["From"] = formataddr((sender_name, sender_email))
    msg["To"] = to_email

    text_content = f"""Hello,

Your verification code for logging in to FileOrganizer AI is:

{otp_code}

This code will expire in 5 minutes and can only be used once.

If you did not attempt to sign in, someone may have entered your email by mistake or is attempting unauthorized access. Please secure your account.

Best regards,
The FileOrganizer AI Security Team
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Login Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f2952; padding: 28px 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">FileOrganizer.ai</h1>
              <p style="color: #93c5fd; margin: 4px 0 0 0; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">Two-Factor Login Authentication</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px; text-align: center;">
              <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 19px; font-weight: 700;">Your One-Time Login Code</h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">
                We received a sign-in request for your account (<strong>{to_email}</strong>). Enter this 6-digit code in the login prompt to complete authentication:
              </p>

              <!-- Big Bold OTP Code Box -->
              <div style="background-color: #f8fafc; border: 2px dashed #0f2952; border-radius: 12px; padding: 18px 24px; display: inline-block; margin: 8px auto 24px auto;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #0f2952; display: block;">
                  {otp_code}
                </span>
              </div>

              <!-- Security notice -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; text-align: left; margin: 16px 0 20px 0;">
                <p style="color: #92400e; font-size: 12px; line-height: 1.5; margin: 0;">
                  <strong>Important:</strong> This verification code expires in <strong>5 minutes</strong> and is strictly single-use. Never share this code with anyone.
                </p>
              </div>

              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 16px 0 0 0; text-align: left;">
                If you did not attempt to sign in, someone may know your password. We strongly recommend resetting your password immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 16px 28px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #94a3b8; font-size: 11px; line-height: 1.5; margin: 0;">
                FileOrganizer AI &bull; Automated Security Service &bull; Do not reply to this email
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    part_text = MIMEText(text_content, "plain", "utf-8")
    part_html = MIMEText(html_content, "html", "utf-8")
    msg.attach(part_text)
    msg.attach(part_html)

    _deliver_email(clean_user, clean_password, msg)

def _deliver_email(clean_user: str, clean_password: str, msg: MIMEMultipart) -> None:
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(clean_user, clean_password)
            server.send_message(msg)
    except smtplib.SMTPAuthenticationError as e:
        raise EmailDeliveryError(
            f"Gmail SMTP authentication failed. Please verify your Gmail App Password. Details: {e}"
        ) from e
    except smtplib.SMTPException as e:
        raise EmailDeliveryError(f"SMTP error occurred while sending email: {e}") from e
    except (OSError, TimeoutError) as e:
        raise EmailDeliveryError(f"Network error connecting to {SMTP_HOST}:{SMTP_PORT}: {e}") from e
    except Exception as e:
        raise EmailDeliveryError(f"Unexpected error sending email: {e}") from e
