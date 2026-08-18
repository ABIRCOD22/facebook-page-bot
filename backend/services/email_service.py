"""Transactional email via Brevo (free tier: 300/day, single-sender verification).

Best-effort, never raises into the caller. Missing BREVO_API_KEY is
treated as "email disabled" — the app keeps working without it.
"""

import logging

import aiohttp

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_email(to_email: str, subject: str, html: str, to_name: str = "") -> bool:
    """Send one transactional email. Returns True on accepted, False otherwise."""
    if not settings.BREVO_API_KEY or not settings.BREVO_FROM_EMAIL:
        logger.info("Email disabled (BREVO_API_KEY/BREVO_FROM_EMAIL not set); skipped %s", subject)
        return False
    payload = {
        "sender": {"email": settings.BREVO_FROM_EMAIL, "name": settings.BREVO_FROM_NAME},
        "to": [{"email": to_email, "name": to_name or None}],
        "subject": subject,
        "htmlContent": html,
    }
    headers = {"api-key": settings.BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json"}
    try:
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.post(
                "https://api.brevo.com/v3/smtp/email",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status in (200, 201, 202):
                    return True
                body = await resp.text()
                logger.warning("Brevo send failed (%s): %s", resp.status, body[:300])
                return False
    except Exception as e:  # noqa: BLE001
        logger.warning("Brevo send error: %s", e)
        return False


def welcome_credentials_html(full_name: str, email: str, password: str, dashboard_url: str) -> str:
    """HTML for the welcome email carrying the client dashboard login."""
    return f"""<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
<h2 style="color:#111827;margin:0 0 8px">Welcome to Chatrix, {full_name}!</h2>
<p style="color:#4b5563;line-height:1.6">Your AI auto-reply bot is ready. Use the credentials below to open your client dashboard:</p>
<table style="margin:16px 0;border-collapse:collapse;width:100%">
<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;color:#6b7280">Dashboard</td><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb"><a href="{dashboard_url}">{dashboard_url}</a></td></tr>
<tr><td style="padding:8px;background:#fff;border:1px solid #e5e7eb;color:#6b7280">Username</td><td style="padding:8px;background:#fff;border:1px solid #e5e7eb">{email}</td></tr>
<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;color:#6b7280">Password</td><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb">{password}</td></tr>
</table>
<p style="color:#6b7280;font-size:13px">Please change your password after first login. Never reply to this email.</p>
</div>"""


def payment_receipt_html(full_name: str, amount: str, currency: str, tier: str, dashboard_url: str) -> str:
    """HTML for the payment receipt email."""
    return f"""<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
<h2 style="color:#111827;margin:0 0 8px">Payment received — thank you!</h2>
<p style="color:#4b5563;line-height:1.6">Hi {full_name}, your <strong>{tier}</strong> plan is active. Your bot is ready to go.</p>
<table style="margin:16px 0;border-collapse:collapse;width:100%">
<tr><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb;color:#6b7280">Amount paid</td><td style="padding:8px;background:#f9fafb;border:1px solid #e5e7eb">{amount} {currency}</td></tr>
<tr><td style="padding:8px;background:#fff;border:1px solid #e5e7eb;color:#6b7280">Plan</td><td style="padding:8px;background:#fff;border:1px solid #e5e7eb">{tier}</td></tr>
</table>
<p style="color:#6b7280;font-size:13px"><a href="{dashboard_url}">Open your dashboard</a> to manage your bot.</p>
</div>"""


def is_email_enabled() -> bool:
    return bool(settings.BREVO_API_KEY and settings.BREVO_FROM_EMAIL)