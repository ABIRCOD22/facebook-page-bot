import logging
from datetime import datetime

from sqlalchemy import and_, select

from database.connection import AsyncSessionFactory
from models.database_models import Subscription

logger = logging.getLogger(__name__)


class SubscriptionService:
    """Checks page access; Phase 1 ships the default free plan."""

    @staticmethod
    async def get_active_subscription_for_page(page: "FacebookPage"):
        """Return the active Subscription for a page, or None.

        Subscriptions are per-user in this model (users.subscription),
        so resolve through the page's owner.
        """
        async with AsyncSessionFactory() as session:
            result = await session.execute(
                select(Subscription).where(
                    and_(
                        Subscription.user_id == page.user_id,
                        Subscription.status == "active",
                        Subscription.expires_at >= datetime.utcnow(),
                    )
                )
            )
            return result.scalar_one_or_none()
