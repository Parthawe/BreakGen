"""Authentication endpoints — signup, login, current user."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from passlib.hash import bcrypt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import settings
from server.db.database import get_db
from server.db.models import UserRow

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_SECRET = "breakgen-dev-secret-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 72


class SignupRequest(BaseModel):
    email: str
    name: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


def _create_token(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> UserRow | None:
    """Extract current user from Authorization header. Returns None if not authenticated."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    payload = _verify_token(auth[7:])
    if not payload:
        return None
    result = await db.execute(
        select(UserRow).where(UserRow.id == int(payload["sub"]))
    )
    return result.scalar_one_or_none()


async def require_user(request: Request, db: AsyncSession = Depends(get_db)) -> UserRow:
    """Like get_current_user but raises 401 if not authenticated."""
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Create a new account."""
    # Check if email already exists
    result = await db.execute(select(UserRow).where(UserRow.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = UserRow(
        email=req.email,
        name=req.name,
        password_hash=bcrypt.hash(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = _create_token(user.id, user.email)
    return AuthResponse(
        token=token,
        user={"id": user.id, "email": user.email, "name": user.name},
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Log in with email and password."""
    result = await db.execute(select(UserRow).where(UserRow.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not bcrypt.verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _create_token(user.id, user.email)
    return AuthResponse(
        token=token,
        user={"id": user.id, "email": user.email, "name": user.name},
    )


@router.get("/me")
async def get_me(user: UserRow = Depends(require_user)):
    """Get current authenticated user."""
    return {"id": user.id, "email": user.email, "name": user.name}
