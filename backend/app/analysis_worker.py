"""Background analysis worker (§9 async flow, FR-4).

Runs in FastAPI BackgroundTasks (no broker at MVP volume — §10
anti-over-engineering). Own DB session (request session is closed by
the time this runs). Every outcome — completed, uncertain, failed —
is a persisted state; the row never stays 'processing' forever
because ANY exception lands in failed with the error stored.
"""
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.config import settings
from app.db import SessionLocal
from app.models import Analysis, AnalysisStatus, AuditLog, Image


def run_analysis(analysis_id: uuid.UUID) -> None:
    db = SessionLocal()
    try:
        analysis = db.get(Analysis, analysis_id)
        if analysis is None or analysis.status != AnalysisStatus.queued:
            return
        analysis.status = AnalysisStatus.processing
        analysis.started_at = datetime.now(timezone.utc)
        db.commit()

        image = db.get(Image, analysis.image_id)
        data = Path(image.file_path).read_bytes()

        resp = httpx.post(f"{settings.model_service_url}/analyze",
                          files={"file": ("image.png", data, "image/png")},
                          timeout=60.0)
        resp.raise_for_status()
        result = resp.json()

        analysis.model_version = result["model_version"]
        analysis.preproc_version = result["preproc_version"]
        analysis.severity_score = result["severity_score"]
        analysis.is_uncertain = result["is_uncertain"]
        # FR-4.4: uncertain → NO grade is stored; manual review required
        analysis.predicted_grade = None if result["is_uncertain"] \
            else result["predicted_grade"]
        # FR-4.5 (§21C: Eigen-CAM): attention map is best-effort —
        # its absence never fails the analysis
        try:
            hm = httpx.post(f"{settings.model_service_url}/heatmap",
                            files={"file": ("image.png", data, "image/png")},
                            timeout=60.0)
            if hm.status_code == 200:
                cam_path = Path(image.file_path).with_name(
                    f"{image.id}_cam.png")
                cam_path.write_bytes(hm.content)
                analysis.gradcam_path = str(cam_path)
        except Exception:
            pass

        analysis.status = AnalysisStatus.completed
        analysis.completed_at = datetime.now(timezone.utc)
        db.add(AuditLog(clinic_id=analysis.clinic_id, user_id=None,
                        action="analysis.completed", entity_type="analysis",
                        entity_id=str(analysis.id),
                        meta={"model_version": result["model_version"],
                              "inference_ms": result["inference_ms"],
                              "is_uncertain": result["is_uncertain"]}))
        db.commit()
    except Exception as e:  # noqa: BLE001 — any failure is a stored state
        db.rollback()
        analysis = db.get(Analysis, analysis_id)
        if analysis is not None:
            analysis.status = AnalysisStatus.failed
            analysis.error_message = str(e)[:500]
            analysis.completed_at = datetime.now(timezone.utc)
            db.add(AuditLog(clinic_id=analysis.clinic_id, user_id=None,
                            action="analysis.failed", entity_type="analysis",
                            entity_id=str(analysis.id)))
            db.commit()
    finally:
        db.close()
