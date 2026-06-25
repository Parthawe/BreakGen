"""Authentication endpoints — signup, login, current user."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import bcrypt as _bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import settings
from server.db.database import get_db
from server.db.models import UserRow

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: str
    name: str
    password: str
    invite_code: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class AuthProvider(BaseModel):
    id: str
    label: str
    enabled: bool
    configured: bool
    status: str
    reason: str
    setup: list[str]


class AuthProvidersResponse(BaseModel):
    password: AuthProvider
    providers: list[AuthProvider]


def _create_token(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None


def user_scope_id(user: object | None) -> int | None:
    """Return an authenticated user id when FastAPI resolved the dependency."""
    user_id = getattr(user, "id", None)
    return user_id if isinstance(user_id, int) else None


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


def _planned_oauth_provider(
    *,
    provider_id: str,
    label: str,
    configured: bool,
    credential_steps: list[str],
) -> AuthProvider:
    if configured:
        return AuthProvider(
            id=provider_id,
            label=label,
            enabled=False,
            configured=True,
            status="server_callback_required",
            reason=(
                "Provider credentials are present, but the server callback, state/nonce "
                "checks, token exchange, and account-linking flow are not enabled yet."
            ),
            setup=[
                "Add provider redirect URI in the OAuth console.",
                "Implement server-side authorization-code callback.",
                "Verify state, nonce, issuer, audience, expiry, and email claims.",
                "Persist a linked identity record before enabling the client button.",
            ],
        )

    return AuthProvider(
        id=provider_id,
        label=label,
        enabled=False,
        configured=False,
        status="credentials_required",
        reason="Provider credentials are not configured for this deployment.",
        setup=credential_steps,
    )


@router.get("/providers", response_model=AuthProvidersResponse)
async def auth_providers():
    """Return the server-owned list of authentication methods for this deployment."""
    return AuthProvidersResponse(
        password=AuthProvider(
            id="password",
            label="Email and password",
            enabled=True,
            configured=True,
            status="active",
            reason=(
                "Email/password login is active. Signup may still be invite-gated "
                "by the alpha operator."
            ),
            setup=[],
        ),
        providers=[
            _planned_oauth_provider(
                provider_id="google",
                label="Google",
                configured=bool(
                    settings.google_oauth_client_id
                    and settings.google_oauth_client_secret
                ),
                credential_steps=[
                    "Set BREAKGEN_GOOGLE_OAUTH_CLIENT_ID.",
                    "Set BREAKGEN_GOOGLE_OAUTH_CLIENT_SECRET.",
                    "Register the backend redirect URI in Google Cloud Console.",
                ],
            ),
            _planned_oauth_provider(
                provider_id="apple",
                label="Apple",
                configured=bool(
                    settings.apple_oauth_client_id
                    and settings.apple_oauth_team_id
                    and settings.apple_oauth_key_id
                    and settings.apple_oauth_private_key
                ),
                credential_steps=[
                    "Set BREAKGEN_APPLE_OAUTH_CLIENT_ID to the Apple Services ID.",
                    "Set BREAKGEN_APPLE_OAUTH_TEAM_ID.",
                    "Set BREAKGEN_APPLE_OAUTH_KEY_ID.",
                    "Set BREAKGEN_APPLE_OAUTH_PRIVATE_KEY through deployment secrets.",
                ],
            ),
        ],
    )


@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Create a new account."""
    if not settings.public_signup_enabled:
        raise HTTPException(status_code=403, detail="Signup is disabled")

    if settings.signup_invite_code and req.invite_code != settings.signup_invite_code:
        raise HTTPException(status_code=403, detail="Invalid invite code")

    email = req.email.strip().lower()
    # Check if email already exists
    result = await db.execute(select(UserRow).where(UserRow.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(req.password) < settings.min_password_length:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {settings.min_password_length} characters",
        )

    user = UserRow(
        email=email,
        name=req.name.strip(),
        password_hash=_bcrypt.hashpw(req.password.encode(), _bcrypt.gensalt()).decode(),
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
    email = req.email.strip().lower()
    result = await db.execute(select(UserRow).where(UserRow.email == email))
    user = result.scalar_one_or_none()

    if not user or not _bcrypt.checkpw(req.password.encode(), user.password_hash.encode()):
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
