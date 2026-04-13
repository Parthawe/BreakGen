"""SQLAlchemy table models for project persistence."""

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    """User account."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(256), default="")
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ProjectRow(Base):
    """Stores the current state of a keyboard project."""

    __tablename__ = "projects"

    project_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    product_family: Mapped[str] = mapped_column(String(32), default="keyboard", index=True)
    name: Mapped[str] = mapped_column(String(256), default="Untitled Project")
    revision: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    template: Mapped[str | None] = mapped_column(String(64), nullable=True)
    data: Mapped[dict] = mapped_column(JSON, doc="Full KeyboardProject JSON")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ProjectRevisionRow(Base):
    """Immutable snapshot of a project at a specific revision."""

    __tablename__ = "project_revisions"
    __table_args__ = (
        UniqueConstraint("project_id", "revision", name="uq_project_revision"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(String(64), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON, doc="Full KeyboardProject JSON snapshot")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
