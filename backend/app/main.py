"""VisionCare AI — Backend API (M3)."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

from app.routers import analyses, analytics, auth, demo, images, patients, reviews, team

app = FastAPI(title="VisionCare AI API", version="0.1.0")
cors_origins = [
    origin.strip()
    for origin in settings.cors_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(demo.router)
app.include_router(patients.router)
app.include_router(images.router)
app.include_router(analyses.router)
app.include_router(reviews.router)
app.include_router(analytics.router)
app.include_router(team.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "api"}
