from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]
ORCHESTRATOR = REPO_ROOT / "services" / "ai-orchestrator"

for path in (str(API_ROOT), str(ORCHESTRATOR)):
    if path not in sys.path:
        sys.path.insert(0, path)

from app.main import create_app  # noqa: E402
from app.repositories import reset_repository  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    reset_repository()
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
    reset_repository()


@pytest.fixture()
def project(client: TestClient) -> dict:
    response = client.post("/api/v1/projects", json={"name": "Test project", "description": "pytest"})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture()
def scene(client: TestClient, project: dict) -> dict:
    projects = client.get("/api/v1/projects").json()
    project_id = projects[0]["id"]
    # The starter scene is created with the project; find it through the repo.
    from app.config import get_settings
    from app.repositories import get_repository

    repository = get_repository(get_settings())
    for document in repository.scenes.values():  # type: ignore[attr-defined]
        if document["project_id"] == project_id:
            return document
    raise AssertionError("starter scene missing")
