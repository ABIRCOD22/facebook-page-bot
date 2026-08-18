"""Generates platform alerts from current DB state. Called on demand / by a background task."""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from database.connection import AsyncSessionFactory
from models.database_models import Alert, FacebookPage, Payment, Subscription, User

logger = logging.getLogger(__name__)


async def _open_alert_exists(session, alert_type: str, target_id) -> bool:
    result = await session.execute(
        select(Alert).where(
            Alert.type == alert_type,
            Alert.related_user_id == target_id,
            Alert.is_resolved == False,  # noqa: E712
        )
    )
    return result.scalar_one_or_none() is not None


async def refresh() -> None:
    """Scan users/subscriptions/payments and open alerts for actionable states."""
    try:
        async with AsyncSessionFactory() as session:
            now = datetime.utcnow()
            soon = now + timedelta(days=3)

            users = (await session.execute(select(User))).scalars().all()
            for user in users:
                sub = (
                    await session.execute(
                        select(Subscription).where(Subscription.user_id == user.id)
                    )
                ).scalar_one_or_none()

                if sub is not None:
                    if sub.status == "suspended":
                        if not await _open_alert_exists(session, "subscription_suspended", user.id):
                            session.add(
                                Alert(
                                    type="subscription_suspended",
                                    severity="warning",
                                    message=f"{user.email}: subscription suspended",
                                    related_user_id=user.id,
                                )
                            )
                    elif (
                        sub.expires_at
                        and sub.status == "active"
                        and sub.expires_at <= soon
                    ):
                        if not await _open_alert_exists(session, "subscription_expiry", user.id):
                            session.add(
                                Alert(
                                    type="subscription_expiry",
                                    severity="warning",
                                    message=f"{user.email}: subscription expires {sub.expires_at.date()}",
                                    related_user_id=user.id,
                                )
                            )

                paused = (
                    await session.execute(
                        select(FacebookPage).where(
                            FacebookPage.user_id == user.id,
                            FacebookPage.is_active == False,  # noqa: E712
                        )
                    )
                ).scalars().all()
                for page in paused:
                    if not await _open_alert_exists(session, "bot_paused", user.id):
                        session.add(
                            Alert(
                                type="bot_paused",
                                severity="info",
                                message=f"{user.email}: bot paused on {page.page_name}",
                                related_user_id=user.id,
                            )
                        )

            failed = (
                await session.execute(select(Payment).where(Payment.status == "failed"))
            ).scalars().all()
            for p in failed:
                if not await _open_alert_exists(session, "payment_failed", p.user_id):
                    session.add(
                        Alert(
                            type="payment_failed",
                            severity="critical",
                            message=f"Payment failed for user {p.user_id}",
                            related_user_id=p.user_id,
                        )
                    )

            await session.commit()
    except Exception as e:
        logger.warning("alert refresh failed: %s", e)
