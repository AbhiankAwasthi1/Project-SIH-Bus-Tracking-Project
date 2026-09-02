from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args=connect_args,
)


if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _sqlite_fast(dbapi_conn, _connection_record) -> None:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-16000")
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.execute("PRAGMA busy_timeout=4000")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    if engine.dialect.name == "postgresql":
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            conn.commit()
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    extra = {
        "jobs": {
            "capture_id": "VARCHAR(36)",
            "hit_count": "INTEGER DEFAULT 0",
        },
        "detections": {
            "capture_id": "VARCHAR(36)",
        },
        "incidents": {
            "city": "VARCHAR(32) DEFAULT 'greater_noida'",
        },
        "buses": {
            "city": "VARCHAR(32) DEFAULT 'greater_noida'",
        },
    }
    with engine.begin() as conn:
        for table, columns in extra.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))} if engine.dialect.name == "sqlite" else {
                row[0] for row in conn.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name = :t"
                ), {"t": table})
            }
            if not existing:
                continue
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
