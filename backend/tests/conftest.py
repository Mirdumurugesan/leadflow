import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.db as dbmod
from app import models  # noqa: F401  (registers tables)
from app.db import Base, get_session
from app.main import app


@pytest.fixture()
def client():
    # A fresh in-memory SQLite database per test; StaticPool shares one connection.
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override():
        with Session() as s:
            yield s

    app.dependency_overrides[get_session] = override
    real_engine, dbmod.engine = dbmod.engine, engine  # startup's init_db() targets the test DB
    with TestClient(app) as c:
        c.Session = Session
        yield c
    app.dependency_overrides.clear()
    dbmod.engine = real_engine
