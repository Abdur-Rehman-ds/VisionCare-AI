"""API contracts (§16). Response envelope: {data} on success — errors
use FastAPI's HTTPException detail; FR-9 language rules apply to any
user-facing clinical text."""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    clinic_id: uuid.UUID

    class Config:
        from_attributes = True


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    role: str = "doctor"


class PatientIn(BaseModel):
    patient_code: str = Field(min_length=1, max_length=64)
    full_name: str = Field(min_length=1, max_length=200)
    date_of_birth: datetime | None = None
    gender: str | None = Field(default=None, max_length=20)


class PatientUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    date_of_birth: datetime | None = None
    gender: str | None = Field(default=None, max_length=20)


class PatientOut(BaseModel):
    id: uuid.UUID
    patient_code: str
    full_name: str
    date_of_birth: datetime | None
    gender: str | None
    is_archived: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PatientListOut(BaseModel):
    data: list[PatientOut]
    total: int
    page: int
    page_size: int


class ImageOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    original_filename: str
    eye_side: str | None
    quality_status: str
    quality_reason: str | None
    created_at: datetime

    class Config:
        from_attributes = True
