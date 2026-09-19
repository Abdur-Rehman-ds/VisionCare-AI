"""VisionCare AI — Model Service (§12.3, §15).
Serves dr-effb3-v1 ONNX on CPU. Stateless, clinically ignorant:
takes image bytes, returns numbers. ALL user-facing language rules
(FR-9) live in the backend, not here — this service speaks JSON only.

Uncertainty (FR-4.4, ordinal adaptation): the ordinal head outputs a
severity score; grade = digitize(score, thresholds). When the score
falls within UNCERTAIN_BAND of a threshold, the call is flagged
is_uncertain=true and the backend shows the manual-review state.
"""
import os
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, HTTPException, UploadFile

from service.preprocess import PREPROC_VERSION, preprocess

MODEL_VERSION = os.environ.get("MODEL_VERSION", "dr-effb3-v1")
MODEL_PATH = Path(f"/models/{MODEL_VERSION}.onnx")
THRESHOLDS = [0.5, 1.5, 2.5, 3.5]
UNCERTAIN_BAND = 0.15  # |score - nearest threshold| below this → uncertain

app = FastAPI(title="VisionCare Model Service", version="0.1.0")
_session: ort.InferenceSession | None = None


@app.on_event("startup")
def load_model() -> None:
    global _session
    if MODEL_PATH.exists():
        _session = ort.InferenceSession(str(MODEL_PATH),
                                        providers=["CPUExecutionProvider"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "model",
            "model_loaded": _session is not None,
            "model_version": MODEL_VERSION}


@app.get("/model-info")
def model_info() -> dict:
    return {"model_version": MODEL_VERSION,
            "preproc_version": PREPROC_VERSION,
            "task": "dr", "thresholds": THRESHOLDS,
            "uncertain_band": UNCERTAIN_BAND,
            "internal_holdout_qwk": 0.9053,
            "external_messidor2": {"qwk": 0.5661, "auc": 0.8438,
                                   "note": "calibration shift documented"}}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> dict:
    if _session is None:
        raise HTTPException(503, "model not loaded")
    data = await file.read()
    t0 = time.time()
    try:
        x = preprocess(data)
    except ValueError as e:
        raise HTTPException(422, str(e))
    score = float(_session.run(None, {"image": x})[0].squeeze())
    grade = int(np.digitize(score, THRESHOLDS))
    dist = float(min(abs(score - t) for t in THRESHOLDS))
    return {"severity_score": round(score, 6),
            "predicted_grade": grade,
            "is_uncertain": bool(dist < UNCERTAIN_BAND),
            "model_version": MODEL_VERSION,
            "preproc_version": PREPROC_VERSION,
            "inference_ms": int((time.time() - t0) * 1000)}
