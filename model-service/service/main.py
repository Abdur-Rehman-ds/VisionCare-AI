"""VisionCare AI — Model Service skeleton (M1).

Real preprocessing/ONNX/Grad-CAM arrive after M2 produces a model
(§12.3, §15). M1 only proves the container starts and reports health.
"""
import os

from fastapi import FastAPI

app = FastAPI(title="VisionCare AI Model Service", version="0.0.1")

MODEL_VERSION = os.getenv("MODEL_VERSION", "none")


@app.get("/health")
def health() -> dict:
    # model_loaded is honestly False until M2 delivers an artifact (§16)
    return {"status": "ok", "model_loaded": False}


@app.get("/model-info")
def model_info() -> dict:
    return {"version": MODEL_VERSION, "task": "dr", "metrics": {}}
