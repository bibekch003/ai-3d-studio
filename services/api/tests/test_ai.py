from fastapi.testclient import TestClient


def plan(client: TestClient, scene: dict, prompt: str, **extra) -> dict:
    response = client.post(
        "/api/v1/ai/edit/plan",
        json={"scene_id": scene["id"], "prompt": prompt, **extra},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_plan_targets_the_named_object(client: TestClient, scene: dict) -> None:
    body = plan(client, scene, "Make the table look like old oak wood.")
    assert body["validation"]["ok"] is True
    operations = body["plan"]["operations"]
    assert any(op["op"] == "set_material" and op["target_id"] == "obj_table" for op in operations)
    assert body["plan"]["producer"]["kind"] == "deterministic"
    assert body["affected"][0]["name"] == "Wooden table"


def test_plan_does_not_mutate_the_scene(client: TestClient, scene: dict) -> None:
    plan(client, scene, "Make the room look like a futuristic laboratory.")
    after = client.get(f"/api/v1/scenes/{scene['id']}").json()["scene"]
    assert after["environment"]["preset_id"] == scene["environment"]["preset_id"]
    assert after["revision"] == scene["revision"]


def test_preservation_is_respected(client: TestClient, scene: dict) -> None:
    body = plan(client, scene, "Change his hairstyle but preserve his identity.")
    assert all(op["op"] != "set_character" for op in body["plan"]["operations"])
    assert "identity" in body["plan"]["preserve"]["properties"]


def test_apply_writes_scene_and_audit(client: TestClient, scene: dict) -> None:
    body = plan(client, scene, "Change the lighting to a sunset atmosphere.")
    applied = client.post("/api/v1/ai/edit/apply", json={"scene_id": scene["id"], "plan": body["plan"]})
    assert applied.status_code == 200, applied.text
    result = applied.json()
    assert result["scene"]["environment"]["time_of_day"] == "sunset"
    assert result["scene"]["revision"] == scene["revision"] + 1
    assert result["audit"]["operations"] == len(body["plan"]["operations"])

    usage = client.get("/api/v1/usage/summary").json()
    assert usage["ai_edits"] == 1


def test_apply_rejects_a_tampered_plan(client: TestClient, scene: dict) -> None:
    body = plan(client, scene, "Make the table look like marble.")
    body["plan"]["operations"].append(
        {"op": "set_light", "target_id": "obj_apple", "params": {"patch": {"intensity_watts": 9000}}}
    )
    response = client.post("/api/v1/ai/edit/apply", json={"scene_id": scene["id"], "plan": body["plan"]})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "plan_invalid"


def test_locked_object_blocks_the_plan(client: TestClient, scene: dict) -> None:
    client.post(
        f"/api/v1/scenes/{scene['id']}/objects:apply",
        json={"operations": [{"op": "set_locked", "target_id": "obj_apple", "params": {"locked": True}}]},
    )
    body = plan(client, scene, "Hide the apple.")
    assert body["validation"]["ok"] is False
    assert any(error["code"] == "plan.target_locked" for error in body["validation"]["errors"])


def test_empty_plan_is_flagged_not_applied(client: TestClient, scene: dict) -> None:
    body = plan(client, scene, "zzzz qqqq")
    assert body["plan"]["operations"] == []
    assert body["validation"]["ok"] is False
    assert body["plan"]["requires_confirmation"] is True


def test_director_returns_editable_shots(client: TestClient) -> None:
    response = client.post(
        "/api/v1/ai/director/plan",
        json={"prompt": "A boy enters a room, walks to a wooden table, picks up a red apple and takes a bite."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["characters"][0]["name"] == "Boy"
    assert len(body["shots"]) == len(body["beats"]) + 1
    assert all(op["op"] in {"set_environment", "add_object", "set_shot"} for op in body["operations"])


def test_select_resolves_natural_language(client: TestClient, scene: dict) -> None:
    body = client.post("/api/v1/ai/select", json={"scene_id": scene["id"], "query": "the apple"}).json()
    assert body["candidates"][0]["object_id"] == "obj_apple"
    assert "obj_apple" in body["recommended"]


def test_adapters_report_unavailable_honestly(client: TestClient) -> None:
    body = client.get("/api/v1/ai/adapters").json()
    assert body["adapters"]
    for adapter in body["adapters"]:
        if not adapter["configured"]:
            assert "not configured" in adapter["message"]


def test_render_request_validates_supported_combinations(client: TestClient, scene: dict) -> None:
    ok = client.post(
        "/api/v1/render/jobs",
        json={"scene_id": scene["id"], "engine": "eevee", "resolution": "1920x1080", "fps": 24, "samples": 32, "frame_range": [0, 48]},
    )
    assert ok.status_code == 202
    job = ok.json()
    assert job["status"] == "queued"

    bad = client.post(
        "/api/v1/render/jobs",
        json={"scene_id": scene["id"], "engine": "eevee", "resolution": "3840x2160", "fps": 24, "samples": 32, "frame_range": [0, 48]},
    )
    assert bad.status_code == 422


def test_job_can_be_cancelled_once(client: TestClient, scene: dict) -> None:
    job = client.post(
        "/api/v1/render/jobs",
        json={"scene_id": scene["id"], "engine": "cycles", "resolution": "1920x1080", "fps": 24, "samples": 128, "frame_range": [0, 24]},
    ).json()
    cancelled = client.post(f"/api/v1/jobs/{job['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    again = client.post(f"/api/v1/jobs/{job['id']}/cancel")
    assert again.status_code == 409
