"""VisionCare AI — Backend API (M3)."""
from fastapi import FastAPI

from app.routers import analyses, auth, images, patients, reviews

app = FastAPI(title="VisionCare AI API", version="0.1.0")
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(images.router)
app.include_router(analyses.router)
app.include_router(reviews.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "api"}
