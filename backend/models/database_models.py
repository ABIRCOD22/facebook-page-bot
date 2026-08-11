import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from database.connection import Base


def generate_uuid():
    return str(uuid.uuid4())


# ============================================
# USER (Page owners who are your clients)
# ============================================
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50))
    role = Column(String(20), default="client")  # super_admin, client
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subscription = relationship("Subscription", back_populates="user", uselist=False)
    pages = relationship("FacebookPage", back_populates="user")
    knowledge_items = relationship("KnowledgeBase", back_populates="user")
    products = relationship("Product", back_populates="user")


# ============================================
# SUBSCRIPTION
# ============================================
class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)

    tier = Column(String(30), default="free_trial")  # free_trial, starter, professional, enterprise
    status = Column(String(20), default="active")  # active, expired, suspended, cancelled

    max_messages_per_month = Column(Integer, default=100)
    max_products = Column(Integer, default=10)
    max_pages = Column(Integer, default=1)
    image_analysis_enabled = Column(Boolean, default=False)

    messages_used = Column(Integer, default=0)
    messages_reset_at = Column(DateTime, default=datetime.utcnow)

    started_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="subscription")


# ============================================
# FACEBOOK PAGE (Connected pages)
# ============================================
class FacebookPage(Base):
    __tablename__ = "facebook_pages"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    page_id = Column(String(100), unique=True, nullable=False, index=True)
    page_name = Column(String(255))
    page_access_token = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    connected_at = Column(DateTime, default=datetime.utcnow)

    # Bot configuration
    bot_name = Column(String(100), default="AI Assistant")
    bot_tone = Column(String(50), default="professional_friendly")
    # Options: professional_friendly, casual, formal, witty
    welcome_message = Column(Text, default="Hi there! How can I help you today?")
    fallback_message = Column(Text, default="Let me connect you with our team for better assistance!")

    user = relationship("User", back_populates="pages")
    conversations = relationship("Conversation", back_populates="page")


# ============================================
# CONVERSATION (Per customer thread)
# ============================================
class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=generate_uuid)
    page_id = Column(String, ForeignKey("facebook_pages.id"), nullable=False)
    customer_fb_id = Column(String(100), nullable=False, index=True)
    customer_name = Column(String(255))

    status = Column(String(20), default="active")  # active, handed_over, closed

    message_count = Column(Integer, default=0)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, default=datetime.utcnow)

    page = relationship("FacebookPage", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", order_by="Message.timestamp")


# ============================================
# MESSAGE (Individual messages)
# ============================================
class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)

    sender_type = Column(String(20), nullable=False)  # customer, bot, human_agent

    content = Column(Text)
    message_type = Column(String(20), default="text")  # text, image, attachment, quick_reply

    image_url = Column(Text)
    confidence_score = Column(Float)

    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    conversation = relationship("Conversation", back_populates="messages")


# ============================================
# KNOWLEDGE BASE
# ============================================
class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), default="general")
    # product, faq, policy, shipping, payment, general, about

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="knowledge_items")


# ============================================
# PRODUCT
# ============================================
class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    name = Column(String(500), nullable=False)
    description = Column(Text)
    price = Column(String(50))
    currency = Column(String(10), default="BDT")
    availability = Column(String(30), default="in_stock")
    # in_stock, out_of_stock, pre_order, limited

    category = Column(String(100))
    variants = Column(Text)  # JSON: {"sizes": ["S","M","L"], "colors": ["Red","Blue"]}
    image_url = Column(Text)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="products")
