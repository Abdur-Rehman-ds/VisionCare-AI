"""VisionCare AI — Backend API skeleton (M1).

Full module layout per §12.1 arrives in M3. M1 only proves the
container topology: this service must respond on /health.
"""
from fastapi import FastAPI

app = FastAPI(title="VisionCare AI API", version="0.0.1")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "api"}
