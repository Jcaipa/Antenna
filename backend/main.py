"""
Antenna Intelligence Platform — FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from database import init_db
from routers import auth, data, runner, users, ai

app = FastAPI(
    title="Antenna Intelligence API",
    description="Backend for Antenna Intelligence Platform — @antpack.co",
    version="1.0.0",
)

# CORS — allow Next.js dev server and production domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for MVP tool flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Init SQLite on startup
@app.on_event("startup")
def startup():
    init_db()

# Routers
app.include_router(auth.router)
app.include_router(data.router)
app.include_router(runner.router)
app.include_router(users.router)
app.include_router(ai.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "Antenna Intelligence API"}


@app.get("/")
def root():
    return {"message": "Antenna Intelligence API v1.0 — docs at /docs"}
