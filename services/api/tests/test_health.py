from fastapi.testclient import TestClient


def test_healthz(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_readyz_reports_repository(client: TestClient) -> None:
    body = client.get("/readyz").json()
    assert body["status"] == "ready"
    assert body["repository"] == "memory"


def test_metrics_are_prometheus_text(client: TestClient) -> None:
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "ai3d_up 1" in response.text


def test_openapi_is_published(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    assert schema["info"]["title"] == "AI 3D Studio API"
    paths = schema["paths"]
    assert "/api/v1/ai/edit/plan" in paths
    assert "/api/v1/render/jobs" in paths


def test_request_id_header_is_echoed(client: TestClient) -> None:
    response = client.get("/healthz", headers={"x-request-id": "test-123"})
    assert response.headers["x-request-id"] == "test-123"
