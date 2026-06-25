"""Configuration safety tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from server.config import DEV_JWT_SECRET, Settings


def test_cors_origins_parse_comma_separated_values():
    settings = Settings(
        cors_origins="http://localhost:5173, https://parthawe.github.io/BreakGen/"
    )

    assert settings.cors_origin_list == [
        "http://localhost:5173",
        "https://parthawe.github.io/BreakGen/",
    ]


def test_production_rejects_wildcard_cors_with_credentials():
    with pytest.raises(ValidationError, match="cannot include"):
        Settings(
            debug=False,
            jwt_secret="prod-secret",
            cors_origins="*",
            cors_allow_credentials=True,
        )


def test_production_requires_non_default_jwt_secret():
    with pytest.raises(ValidationError, match="BREAKGEN_JWT_SECRET"):
        Settings(debug=False, jwt_secret=DEV_JWT_SECRET)


def test_production_rejects_sqlite_database_url():
    for database_url in (
        "sqlite+aiosqlite:///tmp/breakgen-prod.db",
        "sqlite+pysqlite:///tmp/breakgen-prod.db",
    ):
        with pytest.raises(ValidationError, match="BREAKGEN_DATABASE_URL"):
            Settings(
                debug=False,
                jwt_secret="prod-secret",
                cors_origins="https://breakgen.example",
                database_url=database_url,
            )


def test_google_oauth_settings_must_be_complete():
    with pytest.raises(ValidationError, match="GOOGLE_OAUTH"):
        Settings(google_oauth_client_id="google-client")


def test_apple_oauth_settings_must_be_complete():
    with pytest.raises(ValidationError, match="APPLE_OAUTH"):
        Settings(
            apple_oauth_client_id="apple-service-id",
            apple_oauth_team_id="team-id",
        )
