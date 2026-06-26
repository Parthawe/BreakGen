"""Initial BreakGen schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-06-26 00:00:00.000000+00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("password_hash", sa.String(length=256), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)

    op.create_table(
        "projects",
        sa.Column("project_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("product_family", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("template", sa.String(length=64), nullable=True),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("project_id"),
    )
    op.create_index(op.f("ix_projects_product_family"), "projects", ["product_family"], unique=False)
    op.create_index(op.f("ix_projects_user_id"), "projects", ["user_id"], unique=False)

    op.create_table(
        "project_revisions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("project_id", sa.String(length=64), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("change_summary", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "revision", name="uq_project_revision"),
    )
    op.create_index(op.f("ix_project_revisions_project_id"), "project_revisions", ["project_id"], unique=False)

    op.create_table(
        "project_artifacts",
        sa.Column("artifact_id", sa.String(length=64), nullable=False),
        sa.Column("project_id", sa.String(length=64), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("artifact_id"),
    )
    op.create_index(op.f("ix_project_artifacts_kind"), "project_artifacts", ["kind"], unique=False)
    op.create_index(op.f("ix_project_artifacts_project_id"), "project_artifacts", ["project_id"], unique=False)
    op.create_index(op.f("ix_project_artifacts_revision"), "project_artifacts", ["revision"], unique=False)

    op.create_table(
        "project_jobs",
        sa.Column("job_id", sa.String(length=64), nullable=False),
        sa.Column("project_id", sa.String(length=64), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("job_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=True),
        sa.Column("external_ref", sa.String(length=128), nullable=True),
        sa.Column("input_data", sa.JSON(), nullable=False),
        sa.Column("output_data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("job_id"),
    )
    op.create_index(op.f("ix_project_jobs_external_ref"), "project_jobs", ["external_ref"], unique=False)
    op.create_index(op.f("ix_project_jobs_job_type"), "project_jobs", ["job_type"], unique=False)
    op.create_index(op.f("ix_project_jobs_project_id"), "project_jobs", ["project_id"], unique=False)
    op.create_index(op.f("ix_project_jobs_revision"), "project_jobs", ["revision"], unique=False)
    op.create_index(op.f("ix_project_jobs_status"), "project_jobs", ["status"], unique=False)

    op.create_table(
        "project_usage_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("project_id", sa.String(length=64), nullable=True),
        sa.Column("revision", sa.Integer(), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("event_metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_project_usage_events_created_at"), "project_usage_events", ["created_at"], unique=False)
    op.create_index(op.f("ix_project_usage_events_event_type"), "project_usage_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_project_usage_events_project_id"), "project_usage_events", ["project_id"], unique=False)
    op.create_index(op.f("ix_project_usage_events_revision"), "project_usage_events", ["revision"], unique=False)
    op.create_index(op.f("ix_project_usage_events_user_id"), "project_usage_events", ["user_id"], unique=False)

    op.create_table(
        "launch_leads",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role", sa.String(length=64), nullable=False),
        sa.Column("intent", sa.String(length=32), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("surface", sa.String(length=32), nullable=False),
        sa.Column("path", sa.String(length=512), nullable=False),
        sa.Column("referrer", sa.String(length=1024), nullable=False),
        sa.Column("source", sa.JSON(), nullable=False),
        sa.Column("user_agent", sa.String(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_launch_leads_email"), "launch_leads", ["email"], unique=False)
    op.create_index(op.f("ix_launch_leads_intent"), "launch_leads", ["intent"], unique=False)
    op.create_index(op.f("ix_launch_leads_surface"), "launch_leads", ["surface"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_launch_leads_surface"), table_name="launch_leads")
    op.drop_index(op.f("ix_launch_leads_intent"), table_name="launch_leads")
    op.drop_index(op.f("ix_launch_leads_email"), table_name="launch_leads")
    op.drop_table("launch_leads")

    op.drop_index(op.f("ix_project_usage_events_user_id"), table_name="project_usage_events")
    op.drop_index(op.f("ix_project_usage_events_revision"), table_name="project_usage_events")
    op.drop_index(op.f("ix_project_usage_events_project_id"), table_name="project_usage_events")
    op.drop_index(op.f("ix_project_usage_events_event_type"), table_name="project_usage_events")
    op.drop_index(op.f("ix_project_usage_events_created_at"), table_name="project_usage_events")
    op.drop_table("project_usage_events")

    op.drop_index(op.f("ix_project_jobs_status"), table_name="project_jobs")
    op.drop_index(op.f("ix_project_jobs_revision"), table_name="project_jobs")
    op.drop_index(op.f("ix_project_jobs_project_id"), table_name="project_jobs")
    op.drop_index(op.f("ix_project_jobs_job_type"), table_name="project_jobs")
    op.drop_index(op.f("ix_project_jobs_external_ref"), table_name="project_jobs")
    op.drop_table("project_jobs")

    op.drop_index(op.f("ix_project_artifacts_revision"), table_name="project_artifacts")
    op.drop_index(op.f("ix_project_artifacts_project_id"), table_name="project_artifacts")
    op.drop_index(op.f("ix_project_artifacts_kind"), table_name="project_artifacts")
    op.drop_table("project_artifacts")

    op.drop_index(op.f("ix_project_revisions_project_id"), table_name="project_revisions")
    op.drop_table("project_revisions")

    op.drop_index(op.f("ix_projects_user_id"), table_name="projects")
    op.drop_index(op.f("ix_projects_product_family"), table_name="projects")
    op.drop_table("projects")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
