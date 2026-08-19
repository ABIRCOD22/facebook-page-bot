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
    totp_secret = Column(String(64), nullable=True)  # admin 2FA secret (base32)
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

    # Phase 2B: per-page app credentials for multi-tenant webhook verification
    # ponytail: nullable — seeded from env for the demo page; BYOA pages must provide via connect flow
    fb_app_id = Column(String(64), nullable=True)
    fb_app_secret = Column(String(128), nullable=True)

    # Phase 3: per-tenant webhook verify token + business scan results
    verify_token = Column(String(64), nullable=True)  # hub.verify_token for the page's own app webhook
    webhook_verified_at = Column(DateTime, nullable=True)  # set when Meta successfully verifies the callback URL
    business_profile = Column(Text, nullable=True)  # JSON summary from the business scanner
    scan_status = Column(String(20), default="not_scanned")  # not_scanned, pending, done, error
    scanned_at = Column(DateTime, nullable=True)

    # Phase 2C: bot settings — user-configurable from dashboard
    language_mode = Column(String(20), default="auto")  # auto, en_only, bn_only, bilingual
    system_prompt = Column(Text, default="")  # custom instructions injected into prompt
    handover_message = Column(Text, default="Let me connect you with a human agent.")
    auto_handover_after = Column(Integer, default=0)  # 0=disabled, N=auto-handover after N failed attempts
    quick_replies_enabled = Column(Boolean, default=True)
    typing_indicator_enabled = Column(Boolean, default=True)
    fetch_customer_name = Column(Boolean, default=True)

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


# ============================================
# SYSTEM SETTINGS (Admin singleton row, id="global")
# ============================================
class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(String, primary_key=True, default="global")

    maintenance_mode = Column(Boolean, default=False)
    maintenance_message = Column(Text, default="We're performing scheduled maintenance. We'll be back shortly!")
    broadcast_message = Column(Text, default="")
    default_tier = Column(String(30), default="free_trial")


# ============================================
# ALERT (Admin alert center)
# ============================================
class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=generate_uuid)
    severity = Column(String(20), default="info")  # info, warning, critical
    type = Column(String(40), nullable=False)  # subscription_expiry, bot_paused, payment_failed, new_signup, ...
    message = Column(Text, nullable=False)
    related_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    is_resolved = Column(Boolean, default=False)
    snoozed_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================
# AUDIT LOG (Admin action history)
# ============================================
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    admin_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    action = Column(String(60), nullable=False)
    target_type = Column(String(40), nullable=False)
    target_id = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================
# KB TEMPLATE (Global templates admin pushes to users)
# ============================================
class KbTemplate(Base):
    __tablename__ = "kb_templates"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), default="general")
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================
# PAYMENT (Manual + recorded payments for revenue)
# ============================================
class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    amount = Column(String(50), nullable=False)
    currency = Column(String(10), default="BDT")
    method = Column(String(30), default="manual")  # bkash, nagad, rocket, card, manual
    status = Column(String(20), default="completed")  # pending, completed, failed, refunded
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
