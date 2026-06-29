"""Database setup and session management."""

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from server.config import settings

engine = create_async_engine(settings.database_url, echo=settings.debug)


def enable_sqlite_foreign_keys(async_engine: AsyncEngine) -> None:
    """Enable SQLite FK enforcement for local/dev parity with production DBs."""
    if not str(async_engine.url).startswith("sqlite"):
        return

    @event.listens_for(async_engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


enable_sqlite_foreign_keys(engine)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        yield session
