"""Clinic Team & Access Management.

Admin-only endpoints for managing users inside the administrator's own clinic.
Users are never hard-deleted; access is controlled through is_active.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_role
from app.models import AuditLog, Role, User
from app.schemas import (
    RegisterIn,
    TeamMemberOut,
    TeamMemberRoleIn,
    TeamMemberStatusIn,
)
from app.security import hash_password

router = APIRouter(prefix="/api/v1/team", tags=["team"])


def _member_out(user: User) -> TeamMemberOut:
    return TeamMemberOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        created_at=user.created_at,
    )


def _get_clinic_member(db: Session, admin: User, member_id: uuid.UUID) -> User:
    member = db.scalar(
        select(User).where(
            User.id == member_id,
            User.clinic_id == admin.clinic_id,
        )
    )
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team member not found")
    return member


def _active_admin_count(db: Session, clinic_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(User)
            .where(
                User.clinic_id == clinic_id,
                User.role == Role.admin,
                User.is_active.is_(True),
            )
        )
        or 0
    )


@router.get("", response_model=list[TeamMemberOut])
def list_team(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    users = db.scalars(
        select(User)
        .where(User.clinic_id == admin.clinic_id)
        .order_by(User.created_at.asc())
    ).all()
    return [_member_out(user) for user in users]


@router.post("", response_model=TeamMemberOut, status_code=201)
def create_team_member(
    payload: RegisterIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    if payload.role not in {role.value for role in Role}:
        raise HTTPException(422, "Invalid role")

    email = payload.email.lower().strip()
    full_name = payload.full_name.strip()

    if not full_name:
        raise HTTPException(422, "Full name is required")

    existing = db.scalar(select(User.id).where(User.email == email))
    if existing:
        raise HTTPException(409, "Email already registered")

    member = User(
        clinic_id=admin.clinic_id,
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=full_name,
        role=Role(payload.role),
        is_active=True,
    )

    try:
        db.add(member)
        db.flush()

        db.add(
            AuditLog(
                clinic_id=admin.clinic_id,
                user_id=admin.id,
                action="team.member_create",
                entity_type="user",
                entity_id=str(member.id),
                meta={
                    "email": member.email,
                    "role": member.role.value,
                },
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email already registered")

    db.refresh(member)
    return _member_out(member)


@router.patch("/{member_id}/status", response_model=TeamMemberOut)
def update_member_status(
    member_id: uuid.UUID,
    payload: TeamMemberStatusIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    member = _get_clinic_member(db, admin, member_id)

    if member.id == admin.id and not payload.is_active:
        raise HTTPException(409, "You cannot deactivate your own account")

    if (
        member.role == Role.admin
        and member.is_active
        and not payload.is_active
        and _active_admin_count(db, admin.clinic_id) <= 1
    ):
        raise HTTPException(409, "At least one active administrator is required")

    member.is_active = payload.is_active

    db.add(
        AuditLog(
            clinic_id=admin.clinic_id,
            user_id=admin.id,
            action="team.member_status_update",
            entity_type="user",
            entity_id=str(member.id),
            meta={
                "email": member.email,
                "is_active": member.is_active,
            },
        )
    )
    db.commit()
    db.refresh(member)
    return _member_out(member)


@router.patch("/{member_id}/role", response_model=TeamMemberOut)
def update_member_role(
    member_id: uuid.UUID,
    payload: TeamMemberRoleIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    if payload.role not in {role.value for role in Role}:
        raise HTTPException(422, "Invalid role")

    member = _get_clinic_member(db, admin, member_id)
    new_role = Role(payload.role)

    if member.id == admin.id and new_role != Role.admin:
        raise HTTPException(409, "You cannot change your own administrator role")

    if (
        member.role == Role.admin
        and new_role != Role.admin
        and member.is_active
        and _active_admin_count(db, admin.clinic_id) <= 1
    ):
        raise HTTPException(409, "At least one active administrator is required")

    previous_role = member.role.value
    member.role = new_role

    db.add(
        AuditLog(
            clinic_id=admin.clinic_id,
            user_id=admin.id,
            action="team.member_role_update",
            entity_type="user",
            entity_id=str(member.id),
            meta={
                "email": member.email,
                "previous_role": previous_role,
                "new_role": member.role.value,
            },
        )
    )
    db.commit()
    db.refresh(member)
    return _member_out(member)
