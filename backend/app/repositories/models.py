from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, JSON
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class SessionModel(Base):
    __tablename__ = "sessions"
    session_id = Column(String(100), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata_json = Column(JSON, default=dict)

class ResearchRecordModel(Base):
    __tablename__ = "research_records"
    request_id = Column(String(100), primary_key=True)
    session_id = Column(String(100), index=True, nullable=False)
    medicine_name = Column(String(200), index=True, nullable=False)
    query = Column(Text, nullable=False)
    intent = Column(String(50), default="medicine_overview")
    status = Column(String(50), default="completed")
    summary_json = Column(JSON, nullable=False)
    version = Column(Integer, default=1)
    parent_request_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class SourceDocumentModel(Base):
    __tablename__ = "source_documents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(100), index=True, nullable=False)
    research_request_id = Column(String(100), index=True, nullable=False)
    url = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    domain = Column(String(200), nullable=False)
    jurisdiction = Column(String(50), nullable=True)
    source_type = Column(String(100), nullable=False)
    trust_tier = Column(String(10), default="A")
    content_hash = Column(String(64), nullable=True)
    content_snippet = Column(Text, nullable=False)
    published_or_updated_at = Column(String(100), nullable=True)
    retrieved_at = Column(DateTime, default=datetime.utcnow)

class ConversationQuestionModel(Base):
    __tablename__ = "conversation_questions"
    id = Column(String(100), primary_key=True)
    session_id = Column(String(100), index=True, nullable=False)
    research_request_id = Column(String(100), nullable=True)
    medicine_name = Column(String(200), nullable=False)
    question = Column(Text, nullable=False)
    answer_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class SourceChangeCheckModel(Base):
    __tablename__ = "source_change_checks"
    id = Column(String(100), primary_key=True)
    request_id = Column(String(100), index=True, nullable=False)
    checked_at = Column(DateTime, default=datetime.utcnow)
    has_changes = Column(Boolean, default=False)
    changed_urls = Column(JSON, default=list)
    diff_summary = Column(Text, default="")

class MedicineCabinetModel(Base):
    """Stores saved medications for the Expiry Tracker (Feature 6)."""
    __tablename__ = "medicine_cabinet"
    id = Column(String(100), primary_key=True)
    session_id = Column(String(100), index=True, nullable=False)
    medicine_name = Column(String(200), nullable=False)
    brand_name = Column(String(200), nullable=True)
    generic_name = Column(String(200), nullable=True)
    dosage_strength = Column(String(100), nullable=True)
    manufacturer = Column(String(200), nullable=True)
    batch_number = Column(String(100), nullable=True)
    mfg_date = Column(String(100), nullable=True)
    expiry_date = Column(String(100), nullable=False)
    packaging_type = Column(String(50), default="strip")
    notes = Column(Text, nullable=True)
    image_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UploadedDocumentModel(Base):
    """Stores uploaded PDFs and medication leaflets for Document Summarizer (Feature 4)."""
    __tablename__ = "uploaded_documents"
    id = Column(String(100), primary_key=True)
    session_id = Column(String(100), index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    document_title = Column(String(255), nullable=True)
    medicine_name = Column(String(200), nullable=True)
    extracted_text = Column(Text, nullable=False)
    summary_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class DocumentQuestionModel(Base):
    """Stores Q&A grounded strictly in uploaded documents."""
    __tablename__ = "document_questions"
    id = Column(String(100), primary_key=True)
    document_id = Column(String(100), index=True, nullable=False)
    session_id = Column(String(100), index=True, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class ResearchBookmarkModel(Base):
    """Stores user-bookmarked medication monographs for quick reference."""
    __tablename__ = "research_bookmarks"
    id = Column(String(100), primary_key=True)
    session_id = Column(String(100), index=True, nullable=False)
    request_id = Column(String(100), index=True, nullable=False)
    medicine_name = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
