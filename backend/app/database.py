from contextlib import contextmanager
from collections.abc import Iterator
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = PROJECT_ROOT / "backend" / "data" / "venturespot.db"


def get_db_path(db_path: str | Path | None = None) -> Path:
    """Return the configured SQLite database path."""
    if db_path is not None:
        return Path(db_path)

    configured_path = os.getenv("VENTURESPOT_DB_PATH")
    if configured_path:
        return Path(configured_path)

    return DEFAULT_DB_PATH


@contextmanager
def get_connection(
    db_path: str | Path | None = None,
) -> Iterator[sqlite3.Connection]:
    """Open and safely close a SQLite connection."""
    path = get_db_path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")

    try:
        with connection:
            yield connection
    finally:
        connection.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db(db_path: str | Path | None = None) -> None:
    """Create the database tables if they do not exist."""
    with get_connection(db_path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS businesses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                inputs_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                business_id INTEGER NOT NULL,
                analysis_type TEXT NOT NULL,
                inputs_json TEXT NOT NULL,
                results_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (business_id)
                    REFERENCES businesses(id)
                    ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_analyses_business_id
                ON analyses(business_id);

            CREATE INDEX IF NOT EXISTS idx_analyses_created_at
                ON analyses(created_at);
            """
        )


def _business_from_row(row: sqlite3.Row) -> dict[str, Any]:
    """Convert a business database row into a JSON-friendly dictionary."""
    return {
        "id": row["id"],
        "name": row["name"],
        "inputs": json.loads(row["inputs_json"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _analysis_from_row(row: sqlite3.Row) -> dict[str, Any]:
    """Convert an analysis database row into a JSON-friendly dictionary."""
    return {
        "id": row["id"],
        "business_id": row["business_id"],
        "analysis_type": row["analysis_type"],
        "inputs": json.loads(row["inputs_json"]),
        "results": json.loads(row["results_json"]),
        "created_at": row["created_at"],
    }


def create_business(
    name: str,
    inputs: dict[str, Any],
    db_path: str | Path | None = None,
) -> dict[str, Any]:
    """Save a named business and its initial financial assumptions."""
    clean_name = name.strip()
    if not clean_name:
        raise ValueError("Business name cannot be empty.")

    init_db(db_path)
    timestamp = _now()

    with get_connection(db_path) as connection:
        cursor = connection.execute(
            """
            INSERT INTO businesses (
                name, inputs_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                clean_name,
                json.dumps(inputs),
                timestamp,
                timestamp,
            ),
        )

        row = connection.execute(
            "SELECT * FROM businesses WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return _business_from_row(row)


def list_businesses(
    db_path: str | Path | None = None,
) -> list[dict[str, Any]]:
    """Return saved businesses, newest first."""
    init_db(db_path)

    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM businesses
            ORDER BY updated_at DESC, id DESC
            """
        ).fetchall()

    return [_business_from_row(row) for row in rows]


def get_business(
    business_id: int,
    db_path: str | Path | None = None,
) -> dict[str, Any] | None:
    """Return one saved business, or None if it does not exist."""
    init_db(db_path)

    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT * FROM businesses WHERE id = ?",
            (business_id,),
        ).fetchone()

    return _business_from_row(row) if row else None


def save_analysis(
    business_id: int,
    analysis_type: str,
    inputs: dict[str, Any],
    results: dict[str, Any],
    db_path: str | Path | None = None,
) -> dict[str, Any]:
    """Save a result snapshot against an existing business."""
    clean_type = analysis_type.strip()
    if not clean_type:
        raise ValueError("Analysis type cannot be empty.")

    init_db(db_path)

    with get_connection(db_path) as connection:
        business = connection.execute(
            "SELECT id FROM businesses WHERE id = ?",
            (business_id,),
        ).fetchone()

        if business is None:
            raise ValueError(f"Business {business_id} does not exist.")

        cursor = connection.execute(
            """
            INSERT INTO analyses (
                business_id,
                analysis_type,
                inputs_json,
                results_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                business_id,
                clean_type,
                json.dumps(inputs),
                json.dumps(results),
                _now(),
            ),
        )

        row = connection.execute(
            "SELECT * FROM analyses WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return _analysis_from_row(row)


def list_analyses(
    business_id: int,
    db_path: str | Path | None = None,
) -> list[dict[str, Any]]:
    """Return a business's analysis history, newest first."""
    init_db(db_path)

    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT *
            FROM analyses
            WHERE business_id = ?
            ORDER BY created_at DESC, id DESC
            """,
            (business_id,),
        ).fetchall()

    return [_analysis_from_row(row) for row in rows]
