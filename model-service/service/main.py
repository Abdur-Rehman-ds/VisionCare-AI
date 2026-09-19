"""VisionCare AI — Model Service (§12.3, §15).
Serves dr-effb3-v1 ONNX on CPU. Stateless, clinically ignorant:
takes image bytes, returns numbers/pixels. ALL user-facing language
rules (FR-9) live in the backend, not here."""
import os
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, HTTPException, Response, UploadFile

from service.cam import build_cam_model, eigen_cam, overlay
from service.preprocess import PREPROC_VERSION, preprocess_with_image

MODEL_VERSION = os.environ.get("MODEL_VERSION", "dr-effb3-v1")
MODEL_PATH = Path(f"/models/{MODEL_VERSION}.onnx")
CAM_PATH = Path(f"/tmp/{MODEL_VERSION}_cam.onnx")
THRESHOLDS = [0.5, 1.5, 2.5, 3.5]
UNCERTAIN_BAND = 0.15

app = FastAPI(title="VisionCare Model Service", version="0.2.0")
_session: ort.InferenceSession | None = None
_cam_session: ort.InferenceSession | None = None
_feat_name: str | None = None


@app.on_event("startup")
def load_model() -> None:
    global _session, _cam_session, _feat_name
    if MODEL_PATH.exists():
        _session = ort.InferenceSession(str(MODEL_PATH),
                                        providers=["CPUExecutionProvider"])
        try:
            _feat_name = build_cam_model(MODEL_PATH, CAM_PATH)
            _cam_session = ort.InferenceSession(
                str(CAM_PATH), providers=["CPUExecutionProvider"])
        except Exception:
            _cam_session = None  # attention maps optional; /analyze unaffected


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "model",
            "model_loaded": _session is not None,
            "cam_available": _cam_session is not None,
            "model_version": MODEL_VERSION}


@app.get("/model-info")
def model_info() -> dict:
    return {"model_version": MODEL_VERSION,
            "preproc_version": PREPROC_VERSION,
            "task": "dr", "thresholds": THRESHOLDS,
            "uncertain_band": UNCERTAIN_BAND,
            "attention_map": "eigen-cam (gradient-free, FR-4.5 §21C)",
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
        x, _ = preprocess_with_image(data)
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


@app.post("/heatmap")
async def heatmap(file: UploadFile = File(...)) -> Response:
    if _cam_session is None:
        raise HTTPException(503, "attention maps unavailable")
    data = await file.read()
    try:
        x, img300 = preprocess_with_image(data)
    except ValueError as e:
        raise HTTPException(422, str(e))
    outputs = _cam_session.run(None, {"image": x})
    features = outputs[-1]  # appended graph output = feature map
    png = overlay(eigen_cam(features), img300)
    return Response(content=png, media_type="image/png")
