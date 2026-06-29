"""Add database foreign keys for project-owned rows.

Revision ID: 0002_add_foreign_keys
Revises: 0001_initial_schema
Create Date: 2026-06-29 00:00:00.000000+00:00
"""

from __future__ import annotations

from alembic import op


revision = "0002_add_foreign_keys"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.create_foreign_key(
            "fk_projects_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("project_revisions") as batch:
        batch.create_foreign_key(
            "fk_project_revisions_project_id_projects",
            "projects",
            ["project_id"],
            ["project_id"],
            ondelete="CASCADE",
        )

    with op.batch_alter_table("project_artifacts") as batch:
        batch.create_foreign_key(
            "fk_project_artifacts_project_id_projects",
            "projects",
            ["project_id"],
            ["project_id"],
            ondelete="CASCADE",
        )

    with op.batch_alter_table("project_jobs") as batch:
        batch.create_foreign_key(
            "fk_project_jobs_project_id_projects",
            "projects",
            ["project_id"],
            ["project_id"],
            ondelete="CASCADE",
        )

    with op.batch_alter_table("project_usage_events") as batch:
        batch.create_foreign_key(
            "fk_project_usage_events_user_id_users",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_foreign_key(
            "fk_project_usage_events_project_id_projects",
            "projects",
            ["project_id"],
            ["project_id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    with op.batch_alter_table("project_usage_events") as batch:
        batch.drop_constraint("fk_project_usage_events_project_id_projects", type_="foreignkey")
        batch.drop_constraint("fk_project_usage_events_user_id_users", type_="foreignkey")

    with op.batch_alter_table("project_jobs") as batch:
        batch.drop_constraint("fk_project_jobs_project_id_projects", type_="foreignkey")

    with op.batch_alter_table("project_artifacts") as batch:
        batch.drop_constraint("fk_project_artifacts_project_id_projects", type_="foreignkey")

    with op.batch_alter_table("project_revisions") as batch:
        batch.drop_constraint("fk_project_revisions_project_id_projects", type_="foreignkey")

    with op.batch_alter_table("projects") as batch:
        batch.drop_constraint("fk_projects_user_id_users", type_="foreignkey")
