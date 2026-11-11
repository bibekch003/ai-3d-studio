from fastapi.testclient import TestClient


def test_create_and_list_projects(client: TestClient) -> None:
    created = client.post("/api/v1/projects", json={"name": "Night market", "description": "exterior"})
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Night market"
    assert body["scene_count"] == 1

    listed = client.get("/api/v1/projects").json()
    assert any(p["id"] == body["id"] for p in listed)


def test_project_name_is_validated(client: TestClient) -> None:
    response = client.post("/api/v1/projects", json={"name": "x"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


def test_unknown_project_is_404(client: TestClient) -> None:
    response = client.get("/api/v1/projects/00000000-0000-4000-8000-000000000999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "project_not_found"


def test_patch_and_delete_project(client: TestClient, project: dict) -> None:
    patched = client.patch(f"/api/v1/projects/{project['id']}", json={"name": "Renamed"})
    assert patched.status_code == 200
    assert patched.json()["name"] == "Renamed"

    deleted = client.delete(f"/api/v1/projects/{project['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/projects/{project['id']}").status_code == 404
