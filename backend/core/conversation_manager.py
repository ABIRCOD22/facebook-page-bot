import logging
from datetime import datetime

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import AsyncSessionFactory
from models.database_models import Conversation, FacebookPage, Message

logger = logging.getLogger(__name__)


class ConversationManager:
    """One conversation per customer per page."""

    def __init__(self, page_db_id: str):
        """page_db_id is the internal DB id (facebook_pages.id), not Facebook's page ID."""
        self.page_db_id = page_db_id

    async def get_or_create_conversation(
        self, customer_fb_id: str, customer_name: str = None
    ) -> Conversation:
        async with AsyncSessionFactory() as session:
            result = await session.execute(
                select(Conversation).where(
                    and_(
                        Conversation.page_id == self.page_db_id,
                        Conversation.customer_fb_id == customer_fb_id,
                        Conversation.status.in_(["active", "handed_over"]),
                    )
                )
            )
            conversation = result.scalar_one_or_none()

            if conversation:
                conversation.last_message_at = datetime.utcnow()
                await session.commit()
                await session.refresh(conversation)
                return conversation

            conversation = Conversation(
                page_id=self.page_db_id,
                customer_fb_id=customer_fb_id,
                customer_name=customer_name or "Customer",
                status="active",
                message_count=0,
                last_message_at=datetime.utcnow(),
            )
            session.add(conversation)
            await session.commit()
            await session.refresh(conversation)

            logger.info(
                "New conversation %s for customer %s",
                conversation.id[:8],
                customer_fb_id[:10],
            )
            return conversation

    async def add_message(
        self,
        conversation_id: str,
        sender_type: str,  # customer, bot, human_agent
        content: str,
        message_type: str = "text",
        image_url: str = None,
        confidence_score: float = None,
    ) -> Message:
        async with AsyncSessionFactory() as session:
            message = Message(
                conversation_id=conversation_id,
                sender_type=sender_type,
                content=content,
                message_type=message_type,
                image_url=image_url,
                confidence_score=confidence_score,
                timestamp=datetime.utcnow(),
            )
            session.add(message)

            result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            if conversation:
                conversation.message_count += 1
                conversation.last_message_at = datetime.utcnow()

            await session.commit()
            await session.refresh(message)
            return message

    async def get_history(self, conversation_id: str, limit: int = 10) -> list[Message]:
        async with AsyncSessionFactory() as session:
            result = await session.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.timestamp.desc())
                .limit(limit)
            )
            messages = result.scalars().all()
            return list(reversed(messages))

    async def set_status(self, conversation_id: str, status: str):
        async with AsyncSessionFactory() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.id == conversation_id)
            )
            conversation = result.scalar_one_or_none()
            if conversation:
                conversation.status = status
                await session.commit()

    @staticmethod
    async def get_page_by_fb_id(fb_page_id: str) -> FacebookPage:
        """Find our page record by Facebook's page ID."""
        async with AsyncSessionFactory() as session:
            result = await session.execute(
                select(FacebookPage).where(
                    and_(
                        FacebookPage.page_id == fb_page_id,
                        FacebookPage.is_active == True,  # noqa: E712
                    )
                )
            )
            return result.scalar_one_or_none()
