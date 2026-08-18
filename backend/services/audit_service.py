"""Append-only admin audit logging. Never raises into the caller path."""

import logging
from datetime import datetime

from database.connection import AsyncSessionFactory
from models.database_models import AuditLog

logger = logging.getLogger(__name__)


async def log_admin_action(
    admin_user_id,
    action: str,
    target_type: str,
    target_id=None,
    detail: str | None = None,
) -> None:
    """Record an admin action. Best-effort: failures are logged, never thrown."""
    try:
        async with AsyncSessionFactory() as session:
            entry = AuditLog(
                admin_user_id=str(admin_user_id),
                action=action,
                target_type=target_type,
                target_id=str(target_id) if target_id is not None else None,
                detail=detail,
                created_at=datetime.utcnow(),
            )
            session.add(entry)
            await session.commit()
    except Exception as e:  # ponytail: audit must never break the action it logs
        logger.warning("audit log failed: %s", e)
