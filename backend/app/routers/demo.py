"""Internal demo-maintenance endpoints.

These routes are not part of the normal user-facing API.
The nightly reset endpoint is protected by a dedicated secret and is
available only when DEMO_MODE is enabled.
"""

import secrets

from fastapi import APIRouter, Header, HTTPException, status

from app.config import settings
from app.demo_reset import reset_demo_state

router = APIRouter(prefix="/api/v1/internal/demo", tags=["internal-demo"])


@router.post("/reset")
def reset_demo(x_demo_reset_secret: str | None = Header(default=None)):
    if not settings.demo_mode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo mode is disabled",
        )

    if not settings.demo_reset_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Demo reset is not configured",
        )

    if (
        x_demo_reset_secret is None
        or not secrets.compare_digest(
            x_demo_reset_secret,
            settings.demo_reset_secret,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid reset credentials",
        )

    reset_demo_state()

    return {
        "status": "ok",
        "message": "Demo clinic restored to seeded state",
    }
