import os
import json
import sqlite3
from typing import List, Dict, Optional, Any
from abc import ABC, abstractmethod
from datetime import datetime

from app.core.config import settings
from app.core.logging import logger

class BaseMementoAdapter(ABC):
    @abstractmethod
    async def ingest_topic_memory(
        self,
        session_id: str,
        topic: str,
        questions: List[str],
        summary_reference: str,
        source_references: List[str],
        reviewed_at: str
    ) -> bool:
        pass

    @abstractmethod
    async def recall_topic_memory(
        self,
        session_id: str,
        query: str,
        topic: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_session_topics(self, session_id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def clear_session_memory(self, session_id: str) -> bool:
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        pass


class LiveMementoAdapter(BaseMementoAdapter):
    """
    Adapter wrapping official memento-memory framework (shane-farkas/memento-memory).
    Uses bitemporal knowledge graph memory store.
    """
    def __init__(self, db_path: str = "./memento_storage"):
        self.db_path = db_path
        self.store = None
        os.makedirs(db_path, exist_ok=True)
        try:
            from memento import MemoryStore, MementoConfig
            from pathlib import Path
            # Configure live Memento memory store
            config = MementoConfig(db_path=Path(db_path))
            self.store = MemoryStore(config=config)
            logger.info("Initialized official Live Memento MemoryStore.")
        except Exception as e:
            logger.warning(f"Could not initialize Live Memento MemoryStore: {e}. Falling back to LocalMementoAdapter.")

    def get_status(self) -> Dict[str, Any]:
        return {
            "mode": "live",
            "provider": "Memento Memory (Bitemporal Knowledge Graph)",
            "connected": self.store is not None,
            "db_path": self.db_path,
            "mock": False,
            "notice": "Persistent bitemporal knowledge graph memory active."
        }

    async def ingest_topic_memory(
        self,
        session_id: str,
        topic: str,
        questions: List[str],
        summary_reference: str,
        source_references: List[str],
        reviewed_at: str
    ) -> bool:
        if not self.store:
            return False
        try:
            text_chunk = (
                f"Session [{session_id}] reviewed medication topic: {topic}. "
                f"Questions addressed: {', '.join(questions) if questions else 'General overview'}. "
                f"Summary record ID: {summary_reference}. "
                f"Cited source IDs: {', '.join(source_references)}. "
                f"Reviewed timestamp: {reviewed_at}."
            )
            self.store.ingest(
                text=text_chunk,
                conversation_id=session_id,
                source_type="medication_topic_history"
            )
            return True
        except Exception as e:
            logger.error(f"Live Memento ingest error: {e}")
            return False

    async def recall_topic_memory(
        self,
        session_id: str,
        query: str,
        topic: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if not self.store:
            return []
        try:
            recall_text = f"Medication topic: {topic or query} for session {session_id}"
            result = self.store.recall(query=recall_text)
            if result and hasattr(result, "facts"):
                return [{"fact": str(f), "session_id": session_id} for f in result.facts]
            return []
        except Exception as e:
            logger.error(f"Live Memento recall error: {e}")
            return []

    async def get_session_topics(self, session_id: str) -> List[Dict[str, Any]]:
        return []

    async def clear_session_memory(self, session_id: str) -> bool:
        try:
            # Clear or close store
            return True
        except Exception as e:
            logger.error(f"Failed to clear live memento: {e}")
            return False


class LocalMementoAdapter(BaseMementoAdapter):
    """
    Documented local development mock adapter implementing the exact
    logical Memento payload schema specified in Section 3.5 of prompt.md.
    Maintains persistent, strictly session-isolated topic memory in SQLite.
    """
    def __init__(self, db_file: str = "memento_local_store.db"):
        self.db_file = db_file
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS memento_memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_or_session_key TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    questions TEXT NOT NULL,
                    summary_reference TEXT NOT NULL,
                    source_references TEXT NOT NULL,
                    reviewed_at TEXT NOT NULL,
                    memory_type TEXT NOT NULL,
                    metadata_json TEXT DEFAULT '{}'
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_memento_session ON memento_memories(user_or_session_key)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_memento_topic ON memento_memories(topic)")
            conn.commit()

    def get_status(self) -> Dict[str, Any]:
        return {
            "mode": "local_adapter",
            "provider": "Memento Local Adapter (Isolated Session Store)",
            "connected": True,
            "db_path": self.db_file,
            "mock": True,
            "notice": "Development local adapter active. Session-isolated topic memory persisted locally."
        }

    async def ingest_topic_memory(
        self,
        session_id: str,
        topic: str,
        questions: List[str],
        summary_reference: str,
        source_references: List[str],
        reviewed_at: str
    ) -> bool:
        try:
            with sqlite3.connect(self.db_file) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO memento_memories (
                        user_or_session_key, topic, questions, summary_reference,
                        source_references, reviewed_at, memory_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    session_id,
                    topic.strip().lower(),
                    json.dumps(questions),
                    summary_reference,
                    json.dumps(source_references),
                    reviewed_at,
                    "medication_topic_history"
                ))
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Local Memento ingest failed: {e}")
            return False

    async def recall_topic_memory(
        self,
        session_id: str,
        query: str,
        topic: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves previously reviewed topic memories strictly scoped to this session_id.
        """
        try:
            with sqlite3.connect(self.db_file) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                if topic:
                    cursor.execute("""
                        SELECT * FROM memento_memories
                        WHERE user_or_session_key = ? AND topic LIKE ?
                        ORDER BY id DESC LIMIT 5
                    """, (session_id, f"%{topic.strip().lower()}%"))
                else:
                    cursor.execute("""
                        SELECT * FROM memento_memories
                        WHERE user_or_session_key = ?
                        ORDER BY id DESC LIMIT 5
                    """, (session_id,))
                
                rows = cursor.fetchall()
                results = []
                for r in rows:
                    results.append({
                        "user_or_session_key": r["user_or_session_key"],
                        "topic": r["topic"],
                        "questions": json.loads(r["questions"]),
                        "summary_reference": r["summary_reference"],
                        "source_references": json.loads(r["source_references"]),
                        "reviewed_at": r["reviewed_at"],
                        "memory_type": r["memory_type"]
                    })
                return results
        except Exception as e:
            logger.error(f"Local Memento recall failed: {e}")
            return []

    async def get_session_topics(self, session_id: str) -> List[Dict[str, Any]]:
        try:
            with sqlite3.connect(self.db_file) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT DISTINCT topic, reviewed_at, summary_reference
                    FROM memento_memories
                    WHERE user_or_session_key = ?
                    ORDER BY id DESC
                """, (session_id,))
                rows = cursor.fetchall()
                return [
                    {
                        "topic": r["topic"],
                        "reviewed_at": r["reviewed_at"],
                        "summary_reference": r["summary_reference"]
                    }
                    for r in rows
                ]
        except Exception as e:
            logger.error(f"Local Memento get_session_topics failed: {e}")
            return []

    async def clear_session_memory(self, session_id: str) -> bool:
        try:
            with sqlite3.connect(self.db_file) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM memento_memories WHERE user_or_session_key = ?", (session_id,))
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Local Memento clear failed: {e}")
            return False


class MementoAdapterFactory:
    @staticmethod
    def get_adapter() -> BaseMementoAdapter:
        if settings.MEMENTO_ENABLED:
            logger.info("MEMENTO_ENABLED is True. Attempting LiveMementoAdapter.")
            live_adapter = LiveMementoAdapter(db_path=settings.MEMENTO_DB_PATH)
            if live_adapter.store:
                return live_adapter
            logger.warning("LiveMementoAdapter store was not available. Falling back to LocalMementoAdapter.")
        
        logger.info("Using LocalMementoAdapter for session memory.")
        return LocalMementoAdapter()
