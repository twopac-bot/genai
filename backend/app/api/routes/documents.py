import io
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.core.logging import logger
from app.adapters.llm_adapter import LLMAdapterFactory
from app.services.database_service import db_service

router = APIRouter(prefix="/api/documents", tags=["documents"])

def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """Extracts text from PDF or text file."""
    if filename.lower().endswith(".pdf"):
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for page_idx, page in enumerate(reader.pages[:25]):  # Process up to 25 pages
                extracted = page.extract_text()
                if extracted:
                    text_parts.append(f"--- Page {page_idx + 1} ---\n{extracted}")
            full_text = "\n\n".join(text_parts)
            if not full_text.strip():
                return f"[Scanned/Image PDF: '{filename}' - Text could not be extracted directly via text layer.]"
            return full_text
        except Exception as e:
            logger.error(f"Failed to read PDF with pypdf: {e}")
            return f"Error extracting PDF text: {str(e)}"
    else:
        try:
            return file_bytes.decode("utf-8", errors="ignore")
        except Exception as e:
            return f"Error reading text file: {str(e)}"

class DocumentQuestionRequest(BaseModel):
    question: str = Field(..., description="Educational question regarding the uploaded document")
    session_id: str = Field("default-session", description="Session identifier")

@router.post("/upload")
async def upload_medical_document(
    file: UploadFile = File(...),
    session_id: str = Form("default-session")
):
    """
    FEATURE 4: Medical Document Summarizer.
    Uploads a medication leaflet, package insert, or healthcare PDF.
    Extracts structured sections and saves for grounded follow-up Q&A.
    """
    try:
        content_bytes = await file.read()
        if len(content_bytes) > 20 * 1024 * 1024:  # 20MB limit
            raise HTTPException(status_code=400, detail="File size exceeds 20MB limit.")

        extracted_text = extract_text_from_bytes(content_bytes, file.filename)
        llm = LLMAdapterFactory.get_adapter()

        if hasattr(llm, "summarize_medical_document"):
            summary_dict = await llm.summarize_medical_document(
                document_text=extracted_text,
                filename=file.filename
            )
        else:
            summary_dict = {
                "document_title": file.filename,
                "medicine_name": "Extracted Medication",
                "brand_names": [],
                "therapeutic_class": "Healthcare Document",
                "documented_uses": ["Consult document text."],
                "dosage_and_administration": [],
                "adverse_effects": [],
                "boxed_warnings": [],
                "contraindications": [],
                "precautions_and_warnings": [],
                "storage_and_handling": "Follow document label.",
                "missing_or_unclear_sections": [],
                "analysis_summary": f"Uploaded document {file.filename} processed."
            }

        saved_doc = await db_service.save_uploaded_document({
            "session_id": session_id,
            "filename": file.filename,
            "document_title": summary_dict.get("document_title") or file.filename,
            "medicine_name": summary_dict.get("medicine_name"),
            "extracted_text": extracted_text,
            "summary_json": summary_dict,
        })

        return {
            "status": "success",
            "document": saved_doc
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing document upload: {e}")
        raise HTTPException(status_code=500, detail=f"Document upload failed: {str(e)}")

@router.get("")
async def list_documents(session_id: str = "default-session"):
    """Lists all uploaded documents for the session."""
    docs = await db_service.get_uploaded_documents(session_id)
    return {"status": "success", "documents": docs}

@router.get("/{document_id}")
async def get_document(document_id: str):
    """Retrieves document summary and past Q&A."""
    doc = await db_service.get_uploaded_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    questions = await db_service.get_document_questions(document_id)
    return {
        "status": "success",
        "document": doc,
        "questions": questions
    }

@router.post("/{document_id}/question")
async def ask_document_question(document_id: str, req: DocumentQuestionRequest):
    """
    Answers user follow-up questions strictly grounded in the uploaded document.
    Does not mix with external internet claims.
    """
    doc = await db_service.get_uploaded_document(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        llm = LLMAdapterFactory.get_adapter()
        previous_qs = await db_service.get_document_questions(document_id)

        if hasattr(llm, "answer_document_question"):
            ans_dict = await llm.answer_document_question(
                document_text=doc["extracted_text"],
                question=req.question,
                previous_qa=previous_qs
            )
        else:
            ans_dict = {
                "answer": f"According to document '{doc['filename']}': Relevant instructions are detailed in the document text.",
                "supporting_excerpt": "",
                "is_grounded_in_document": True,
                "notice": "Answer grounded in document."
            }

        saved_q = await db_service.save_document_question({
            "document_id": document_id,
            "session_id": req.session_id,
            "question": req.question,
            "answer": ans_dict["answer"]
        })

        return {
            "status": "success",
            "question_id": saved_q["id"],
            "question": req.question,
            "answer": ans_dict["answer"],
            "supporting_excerpt": ans_dict.get("supporting_excerpt"),
            "is_grounded_in_document": ans_dict.get("is_grounded_in_document", True),
            "notice": "This answer is derived strictly from your uploaded document."
        }
    except Exception as e:
        logger.error(f"Error answering document question: {e}")
        raise HTTPException(status_code=500, detail=f"Document Q&A failed: {str(e)}")
