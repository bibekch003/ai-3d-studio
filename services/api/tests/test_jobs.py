from fastapi.testclient import TestClient

from app.config import get_settings


def _job(client: TestClient, scene: dict) -> dict:
    response = client.post(
        "/api/v1/render/jobs",
        json={"scene_id": scene["id"], "engine": "eevee", "resolution": "1920x1080", "fps": 24, "samples": 16, "frame_range": [0, 24]},
    )
    assert response.status_code == 202
    return response.json()


def test_worker_callback_requires_service_token(client: TestClient, scene: dict) -> None:
    job = _job(client, scene)
    response = client.post(
        f"/api/v1/jobs/{job['id']}/progress",
        json={"status": "running", "progress": 0.4, "message": "Blender started"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_service_token"


def test_worker_callback_updates_status(client: TestClient, scene: dict, monkeypatch) -> None:
    monkeypatch.setenv("SERVICE_TOKEN", "test-service-token")
    get_settings.cache_clear()
    job = _job(client, scene)
    response = client.post(
        f"/api/v1/jobs/{job['id']}/progress",
        headers={"x-service-token": "test-service-token"},
        json={"status": "succeeded", "progress": 1.0, "message": "done", "output_url": "s3://bucket/out.mp4"},
    )
    get_settings.cache_clear()
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "succeeded"
    assert body["output_url"] == "s3://bucket/out.mp4"


def test_cancelled_job_cannot_be_resurrected(client: TestClient, scene: dict, monkeypatch) -> None:
    monkeypatch.setenv("SERVICE_TOKEN", "tok")
    get_settings.cache_clear()
    job = _job(client, scene)
    client.post(f"/api/v1/jobs/{job['id']}/cancel")
    response = client.post(
        f"/api/v1/jobs/{job['id']}/progress",
        headers={"x-service-token": "tok"},
        json={"status": "running", "progress": 0.5, "message": "late"},
    )
    get_settings.cache_clear()
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "job_cancelled"
