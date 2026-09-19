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
