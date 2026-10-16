from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import init_db
from .routes import files, duplicates, search, stats, settings, auth

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and directories on startup
    init_db()
    yield

app = FastAPI(
    title="AI-Powered File Organizer API",
    description="Backend API with FastAPI, ChromaDB, Ollama embeddings, and hash duplicate detection",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(files.router)
app.include_router(duplicates.router)
app.include_router(search.router)
app.include_router(stats.router)
app.include_router(settings.router)

@app.get("/")
def root():
    return {
        "app": "AI-Powered File Organizer",
        "status": "healthy",
        "version": "1.0.0",
        "docs": "/docs"
    }
