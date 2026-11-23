from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, delete, desc, update
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import uuid

from app.core.config import settings
from app.core.logging import logger
from app.repositories.models import (
    Base,
    SessionModel,
    ResearchRecordModel,
    SourceDocumentModel,
    ConversationQuestionModel,
    SourceChangeCheckModel,
    MedicineCabinetModel,
    UploadedDocumentModel,
    DocumentQuestionModel,
    ResearchBookmarkModel,
)

class DatabaseService:
    def __init__(self, db_url: Optional[str] = None):
        self.db_url = db_url or settings.DATABASE_URL
        connect_args = {"check_same_thread": False} if "sqlite" in self.db_url else {}
        self.engine = create_async_engine(
            self.db_url,
            echo=False,
            future=True,
            connect_args=connect_args
        )
        self.session_factory = async_sessionmaker(
            self.engine,
            expire_on_commit=False,
            class_=AsyncSession
        )

    async def init_db(self):
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database schema initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise

    async def get_or_create_session(self, session_id: str, metadata: Optional[Dict[str, Any]] = None) -> SessionModel:
        async with self.session_factory() as session:
            stmt = select(SessionModel).where(SessionModel.session_id == session_id)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing:
                existing.last_active_at = datetime.utcnow()
                if metadata:
                    existing.metadata_json = {**(existing.metadata_json or {}), **metadata}
                await session.commit()
                return existing
            
            new_session = SessionModel(
                session_id=session_id,
                metadata_json=metadata or {}
            )
            session.add(new_session)
            await session.commit()
            return new_session

    async def save_research_record(
        self,
        request_id: str,
        session_id: str,
        medicine_name: str,
        query: str,
        summary_dict: dict,
        intent: str = "medicine_overview",
        version: int = 1,
        parent_request_id: Optional[str] = None
    ) -> ResearchRecordModel:
        await self.get_or_create_session(session_id)
        async with self.session_factory() as session:
            record = ResearchRecordModel(
                request_id=request_id,
                session_id=session_id,
                medicine_name=medicine_name,
                query=query,
                intent=intent,
                summary_json=summary_dict,
                version=version,
                parent_request_id=parent_request_id
            )
            session.add(record)
            await session.commit()
            return record

    async def get_research_record(self, request_id: str) -> Optional[dict]:
        async with self.session_factory() as session:
            stmt = select(ResearchRecordModel).where(ResearchRecordModel.request_id == request_id)
            result = await session.execute(stmt)
            rec = result.scalar_one_or_none()
            if rec:
                return {
                    "request_id": rec.request_id,
                    "session_id": rec.session_id,
                    "medicine_name": rec.medicine_name,
                    "query": rec.query,
                    "intent": rec.intent,
                    "summary": rec.summary_json,
                    "version": rec.version,
                    "parent_request_id": rec.parent_request_id,
                    "created_at": rec.created_at.isoformat() if rec.created_at else None
                }
            return None

    async def save_source_documents(self, documents: List[dict]):
        async with self.session_factory() as session:
            for d in documents:
                doc = SourceDocumentModel(
                    source_id=d["source_id"],
                    research_request_id=d["research_request_id"],
                    url=d["url"],
                    title=d["title"],
                    domain=d["domain"],
                    jurisdiction=d.get("jurisdiction"),
                    source_type=d["source_type"],
                    trust_tier=d.get("trust_tier", "A"),
                    content_hash=d.get("content_hash"),
                    content_snippet=d["content"][:2000] if "content" in d else "",
                    published_or_updated_at=d.get("published_or_updated_at"),
                )
                session.add(doc)
            await session.commit()

    async def get_sources_for_request(self, request_id: str) -> List[dict]:
        async with self.session_factory() as session:
            stmt = select(SourceDocumentModel).where(SourceDocumentModel.research_request_id == request_id)
            result = await session.execute(stmt)
            docs = result.scalars().all()
            return [
                {
                    "source_id": d.source_id,
                    "url": d.url,
                    "title": d.title,
                    "domain": d.domain,
                    "jurisdiction": d.jurisdiction,
                    "source_type": d.source_type,
                    "trust_tier": d.trust_tier,
                    "content_hash": d.content_hash,
                    "snippet": d.content_snippet,
                    "published_or_updated_at": d.published_or_updated_at,
                    "retrieved_at": d.retrieved_at.isoformat() if d.retrieved_at else None
                }
                for d in docs
            ]

    async def save_conversation_question(
        self,
        question_id: str,
        session_id: str,
        medicine_name: str,
        question: str,
        answer_json: dict,
        research_request_id: Optional[str] = None
    ):
        async with self.session_factory() as session:
            q = ConversationQuestionModel(
                id=question_id,
                session_id=session_id,
                medicine_name=medicine_name,
                question=question,
                answer_json=answer_json,
                research_request_id=research_request_id
            )
            session.add(q)
            await session.commit()

    async def get_session_history(self, session_id: str) -> Dict[str, Any]:
        async with self.session_factory() as session:
            stmt_records = (
                select(ResearchRecordModel)
                .where(ResearchRecordModel.session_id == session_id)
                .order_by(desc(ResearchRecordModel.created_at))
            )
            records_res = await session.execute(stmt_records)
            records = records_res.scalars().all()

            stmt_questions = (
                select(ConversationQuestionModel)
                .where(ConversationQuestionModel.session_id == session_id)
                .order_by(desc(ConversationQuestionModel.created_at))
            )
            questions_res = await session.execute(stmt_questions)
            questions = questions_res.scalars().all()

            stmt_bookmarks = (
                select(ResearchBookmarkModel)
                .where(ResearchBookmarkModel.session_id == session_id)
                .order_by(desc(ResearchBookmarkModel.created_at))
            )
            bookmarks_res = await session.execute(stmt_bookmarks)
            bookmarks = bookmarks_res.scalars().all()

            return {
                "session_id": session_id,
                "research_records": [
                    {
                        "request_id": r.request_id,
                        "medicine_name": r.medicine_name,
                        "query": r.query,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                        "version": r.version,
                        "summary_overview": r.summary_json.get("overview", {}).get("text", "")[:200] if r.summary_json else ""
                    }
                    for r in records
                ],
                "questions": [
                    {
                        "id": q.id,
                        "medicine_name": q.medicine_name,
                        "question": q.question,
                        "answer_preview": q.answer_json.get("answer", "")[:150] if q.answer_json else "",
                        "created_at": q.created_at.isoformat() if q.created_at else None,
                        "research_request_id": q.research_request_id
                    }
                    for q in questions
                ],
                "bookmarks": [
                    {
                        "id": b.id,
                        "request_id": b.request_id,
                        "medicine_name": b.medicine_name,
                        "created_at": b.created_at.isoformat() if b.created_at else None,
                    }
                    for b in bookmarks
                ]
            }

    async def log_source_change_check(
        self,
        check_id: str,
        request_id: str,
        has_changes: bool,
        changed_urls: List[str],
        diff_summary: str
    ):
        async with self.session_factory() as session:
            entry = SourceChangeCheckModel(
                id=check_id,
                request_id=request_id,
                has_changes=has_changes,
                changed_urls=changed_urls,
                diff_summary=diff_summary
            )
            session.add(entry)
            await session.commit()

    async def clear_session_history(self, session_id: str):
        async with self.session_factory() as session:
            await session.execute(delete(ResearchRecordModel).where(ResearchRecordModel.session_id == session_id))
            await session.execute(delete(ConversationQuestionModel).where(ConversationQuestionModel.session_id == session_id))
            await session.execute(delete(ResearchBookmarkModel).where(ResearchBookmarkModel.session_id == session_id))
            await session.execute(delete(SessionModel).where(SessionModel.session_id == session_id))
            await session.commit()

    # --- Feature 6: Medicine Cabinet & Expiry Tracker Methods ---
    async def save_cabinet_item(self, item_data: dict) -> dict:
        item_id = item_data.get("id") or str(uuid.uuid4())
        session_id = item_data["session_id"]
        await self.get_or_create_session(session_id)
        async with self.session_factory() as session:
            item = MedicineCabinetModel(
                id=item_id,
                session_id=session_id,
                medicine_name=item_data["medicine_name"],
                brand_name=item_data.get("brand_name"),
                generic_name=item_data.get("generic_name"),
                dosage_strength=item_data.get("dosage_strength"),
                manufacturer=item_data.get("manufacturer"),
                batch_number=item_data.get("batch_number"),
                mfg_date=item_data.get("mfg_date"),
                expiry_date=item_data["expiry_date"],
                packaging_type=item_data.get("packaging_type", "strip"),
                notes=item_data.get("notes"),
                image_data=item_data.get("image_data"),
            )
            session.add(item)
            await session.commit()
            return await self.get_cabinet_item(item_id)

    async def get_cabinet_item(self, item_id: str) -> Optional[dict]:
        async with self.session_factory() as session:
            stmt = select(MedicineCabinetModel).where(MedicineCabinetModel.id == item_id)
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            if not m:
                return None
            return {
                "id": m.id,
                "session_id": m.session_id,
                "medicine_name": m.medicine_name,
                "brand_name": m.brand_name,
                "generic_name": m.generic_name,
                "dosage_strength": m.dosage_strength,
                "manufacturer": m.manufacturer,
                "batch_number": m.batch_number,
                "mfg_date": m.mfg_date,
                "expiry_date": m.expiry_date,
                "packaging_type": m.packaging_type,
                "notes": m.notes,
                "image_data": m.image_data,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }

    async def get_cabinet_items(self, session_id: str) -> List[dict]:
        async with self.session_factory() as session:
            stmt = select(MedicineCabinetModel).where(MedicineCabinetModel.session_id == session_id).order_by(MedicineCabinetModel.expiry_date.asc())
            res = await session.execute(stmt)
            items = res.scalars().all()
            return [
                {
                    "id": m.id,
                    "session_id": m.session_id,
                    "medicine_name": m.medicine_name,
                    "brand_name": m.brand_name,
                    "generic_name": m.generic_name,
                    "dosage_strength": m.dosage_strength,
                    "manufacturer": m.manufacturer,
                    "batch_number": m.batch_number,
                    "mfg_date": m.mfg_date,
                    "expiry_date": m.expiry_date,
                    "packaging_type": m.packaging_type,
                    "notes": m.notes,
                    "image_data": m.image_data,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in items
            ]

    async def update_cabinet_item(self, item_id: str, session_id: str, updates: dict) -> Optional[dict]:
        async with self.session_factory() as session:
            stmt = select(MedicineCabinetModel).where(MedicineCabinetModel.id == item_id, MedicineCabinetModel.session_id == session_id)
            res = await session.execute(stmt)
            item = res.scalar_one_or_none()
            if not item:
                return None
            for k, v in updates.items():
                if hasattr(item, k) and k not in ["id", "session_id", "created_at"]:
                    setattr(item, k, v)
            await session.commit()
            return await self.get_cabinet_item(item_id)

    async def delete_cabinet_item(self, item_id: str, session_id: str) -> bool:
        async with self.session_factory() as session:
            stmt = delete(MedicineCabinetModel).where(MedicineCabinetModel.id == item_id, MedicineCabinetModel.session_id == session_id)
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount > 0

    # --- Feature 4: Uploaded Document Summaries & Q&A ---
    async def save_uploaded_document(self, doc_data: dict) -> dict:
        doc_id = doc_data.get("id") or str(uuid.uuid4())
        session_id = doc_data["session_id"]
        await self.get_or_create_session(session_id)
        async with self.session_factory() as session:
            doc = UploadedDocumentModel(
                id=doc_id,
                session_id=session_id,
                filename=doc_data["filename"],
                document_title=doc_data.get("document_title"),
                medicine_name=doc_data.get("medicine_name"),
                extracted_text=doc_data["extracted_text"],
                summary_json=doc_data["summary_json"],
            )
            session.add(doc)
            await session.commit()
            return await self.get_uploaded_document(doc_id)

    async def get_uploaded_document(self, doc_id: str) -> Optional[dict]:
        async with self.session_factory() as session:
            stmt = select(UploadedDocumentModel).where(UploadedDocumentModel.id == doc_id)
            res = await session.execute(stmt)
            d = res.scalar_one_or_none()
            if not d:
                return None
            return {
                "id": d.id,
                "session_id": d.session_id,
                "filename": d.filename,
                "document_title": d.document_title,
                "medicine_name": d.medicine_name,
                "extracted_text": d.extracted_text,
                "summary": d.summary_json,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }

    async def get_uploaded_documents(self, session_id: str) -> List[dict]:
        async with self.session_factory() as session:
            stmt = select(UploadedDocumentModel).where(UploadedDocumentModel.session_id == session_id).order_by(desc(UploadedDocumentModel.created_at))
            res = await session.execute(stmt)
            docs = res.scalars().all()
            return [
                {
                    "id": d.id,
                    "session_id": d.session_id,
                    "filename": d.filename,
                    "document_title": d.document_title,
                    "medicine_name": d.medicine_name,
                    "summary": d.summary_json,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in docs
            ]

    async def save_document_question(self, q_data: dict) -> dict:
        q_id = str(uuid.uuid4())
        async with self.session_factory() as session:
            dq = DocumentQuestionModel(
                id=q_id,
                document_id=q_data["document_id"],
                session_id=q_data["session_id"],
                question=q_data["question"],
                answer=q_data["answer"],
            )
            session.add(dq)
            await session.commit()
            return {
                "id": q_id,
                "document_id": q_data["document_id"],
                "question": q_data["question"],
                "answer": q_data["answer"],
                "created_at": datetime.utcnow().isoformat()
            }

    async def get_document_questions(self, document_id: str) -> List[dict]:
        async with self.session_factory() as session:
            stmt = select(DocumentQuestionModel).where(DocumentQuestionModel.document_id == document_id).order_by(DocumentQuestionModel.created_at.asc())
            res = await session.execute(stmt)
            qs = res.scalars().all()
            return [
                {
                    "id": q.id,
                    "document_id": q.document_id,
                    "question": q.question,
                    "answer": q.answer,
                    "created_at": q.created_at.isoformat() if q.created_at else None,
                }
                for q in qs
            ]

    # --- Feature 11: Research Bookmarks ---
    async def add_bookmark(self, session_id: str, request_id: str, medicine_name: str) -> dict:
        b_id = str(uuid.uuid4())
        async with self.session_factory() as session:
            bm = ResearchBookmarkModel(
                id=b_id,
                session_id=session_id,
                request_id=request_id,
                medicine_name=medicine_name,
            )
            session.add(bm)
            await session.commit()
            return {
                "id": b_id,
                "session_id": session_id,
                "request_id": request_id,
                "medicine_name": medicine_name,
                "created_at": datetime.utcnow().isoformat()
            }

    async def remove_bookmark(self, bookmark_id: str, session_id: str) -> bool:
        async with self.session_factory() as session:
            stmt = delete(ResearchBookmarkModel).where(ResearchBookmarkModel.id == bookmark_id, ResearchBookmarkModel.session_id == session_id)
            res = await session.execute(stmt)
            await session.commit()
            return res.rowcount > 0

db_service = DatabaseService()
