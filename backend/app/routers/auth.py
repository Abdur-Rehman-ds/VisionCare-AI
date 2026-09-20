"""Auth endpoints (§16): login, me, register (admin-only)."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_role
from app.models import AuditLog, Clinic, Role, User
from app.schemas import RegisterIn, TokenOut, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == form.username.lower()))
    if user is None or not verify_password(form.password, user.hashed_password):
        # deliberately identical message for both cases (no user enumeration)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account disabled")
    db.add(AuditLog(clinic_id=user.clinic_id, user_id=user.id, action="auth.login"))
    db.commit()
    return TokenOut(access_token=create_access_token(
        str(user.id), str(user.clinic_id), user.role.value))


@router.get("/me", response_model=UserOut)
def me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clinic = db.get(Clinic, user.clinic_id)
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        clinic_id=user.clinic_id,
        is_demo=bool(clinic and clinic.is_demo),
    )


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db),
             admin: User = Depends(require_role("admin"))):
    """Admin creates users within their OWN clinic (clinic scoping)."""
    if payload.role not in {r.value for r in Role}:
        raise HTTPException(422, "Invalid role")
    exists = db.scalar(select(User).where(User.email == payload.email.lower()))
    if exists:
        raise HTTPException(409, "Email already registered")
    user = User(clinic_id=admin.clinic_id, email=payload.email.lower(),
                hashed_password=hash_password(payload.password),
                full_name=payload.full_name, role=Role(payload.role))
    db.add(user)
    db.add(AuditLog(clinic_id=admin.clinic_id, user_id=admin.id,
                    action="user.create", entity_type="user",
                    meta={"email": payload.email.lower(), "role": payload.role}))
    db.commit()
    db.refresh(user)
    return user


@router.post("/demo-login", response_model=TokenOut)
def demo_login(db: Session = Depends(get_db)):
    """Sign in to the isolated demo clinic when DEMO_MODE is enabled."""
    if not settings.demo_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo mode is disabled")

    demo_email = "admin@visioncare-demo.example.com"
    user = db.scalar(
        select(User)
        .join(Clinic, User.clinic_id == Clinic.id)
        .where(
            User.email == demo_email,
            Clinic.is_demo.is_(True),
        )
    )

    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Demo account unavailable")

    db.add(
        AuditLog(
            clinic_id=user.clinic_id,
            user_id=user.id,
            action="auth.demo_login",
        )
    )
    db.commit()

    return TokenOut(
        access_token=create_access_token(
            str(user.id),
            str(user.clinic_id),
            user.role.value,
        )
    )
