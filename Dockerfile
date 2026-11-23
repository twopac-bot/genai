# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + embedded frontend ─────────────────────────────
FROM python:3.11-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend into expected location
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port (Render sets $PORT at runtime)
EXPOSE 8000

# Start uvicorn — bind to 0.0.0.0 so Render can reach it
CMD ["sh", "-c", "cd /app && PYTHONPATH=backend uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
