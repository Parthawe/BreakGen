"""Seed or update a private-alpha reviewer account."""

from __future__ import annotations

import argparse
import asyncio
import os
from datetime import datetime, timezone

import bcrypt as _bcrypt
from sqlalchemy import select

from server.api.auth import MAX_BCRYPT_PASSWORD_BYTES
from server.config import settings
from server.db.database import async_session
from server.db.models import UserRow


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed a BreakGen private-alpha user.")
    parser.add_argument(
        "--email",
        default="pawar.d.parth@gmail.com",
        help="Reviewer email to create or update.",
    )
    parser.add_argument(
        "--name",
        default="Parth",
        help="Display name for the reviewer account.",
    )
    parser.add_argument(
        "--password",
        default=os.getenv("BREAKGEN_ALPHA_PASSWORD"),
        help="Password to assign to the reviewer account. Can also be set with BREAKGEN_ALPHA_PASSWORD.",
    )
    return parser.parse_args()


async def seed_user(email: str, name: str, password: str) -> None:
    email = email.strip().lower()
    name = name.strip()
    if len(password) < settings.min_password_length:
        raise ValueError(
            f"Password must be at least {settings.min_password_length} characters"
        )
    if len(password.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
        raise ValueError(f"Password must be {MAX_BCRYPT_PASSWORD_BYTES} bytes or fewer")

    async with async_session() as db:
        result = await db.execute(select(UserRow).where(UserRow.email == email))
        user = result.scalar_one_or_none()
        password_hash = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

        if user is None:
            user = UserRow(
                email=email,
                name=name,
                password_hash=password_hash,
                created_at=datetime.now(timezone.utc),
            )
            db.add(user)
            action = "created"
        else:
            user.name = name
            user.password_hash = password_hash
            action = "updated"

        await db.commit()
        print(f"{action}: {email}")


def main() -> None:
    args = parse_args()
    if not args.password:
        raise SystemExit(
            "Provide --password or set BREAKGEN_ALPHA_PASSWORD before seeding."
        )
    asyncio.run(seed_user(args.email, args.name, args.password))


if __name__ == "__main__":
    main()
