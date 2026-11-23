import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.logging import logger
from app.services.database_service import db_service
from app.api.routes import (
    research,
    followups,
    compare,
    history,
    health,
    scanner,
    interactions,
    documents,
    cabinet,
    assistant_features,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing DrugInfo AI backend...")
    await db_service.init_db()
    logger.info("Database initialized.")
    yield
    logger.info("Shutting down DrugInfo AI backend.")

app = FastAPI(
    title="DrugInfo AI – Medication Information Assistant",
    description="Evidence-grounded medication educational information API with Firecrawl retrieval and Memento memory integration.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(research.router)
app.include_router(followups.router)
app.include_router(compare.router)
app.include_router(history.router)
app.include_router(health.router)
app.include_router(scanner.router)
app.include_router(interactions.router)
app.include_router(documents.router)
app.include_router(cabinet.router)
app.include_router(assistant_features.router)

# Mount frontend build if available for seamless full-stack deployment
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist) and os.path.exists(os.path.join(frontend_dist, "index.html")):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Do not catch API routes
        if full_path.startswith("api/") or full_path == "api":
            return {"error": "API route not found"}
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "app": "DrugInfo AI",
            "description": "Evidence-grounded medication educational information API",
            "documentation": "/docs",
            "health": "/api/health"
        }
