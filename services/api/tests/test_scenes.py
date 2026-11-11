from fastapi.testclient import TestClient


def test_load_scene(client: TestClient, scene: dict) -> None:
    response = client.get(f"/api/v1/scenes/{scene['id']}")
    assert response.status_code == 200
    document = response.json()["scene"]
    assert document["schema_version"] == "1.1"
    assert any(o["id"] == "obj_apple" for o in document["objects"])


def test_save_requires_matching_revision(client: TestClient, scene: dict) -> None:
    stale = {**scene, "revision": scene["revision"] + 5, "name": "Stale copy"}
    # The client claims to be saving on top of a revision the server never had.
    response = client.put(
        f"/api/v1/scenes/{scene['id']}", json={"scene": stale, "expected_revision": scene["revision"] + 5}
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "revision_conflict"


def test_save_rejects_invalid_scene(client: TestClient, scene: dict) -> None:
    broken = {**scene, "objects": [{"id": "x", "name": "no type"}]}
    response = client.put(f"/api/v1/scenes/{scene['id']}", json={"scene": broken, "expected_revision": scene["revision"]})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "scene_invalid"


def test_direct_object_operations(client: TestClient, scene: dict) -> None:
    response = client.post(
        f"/api/v1/scenes/{scene['id']}/objects:apply",
        json={
            "operations": [
                {"op": "set_transform", "target_id": "obj_apple", "params": {"position": [1.0, 0.9, -1.4]}},
                {"op": "set_visibility", "target_id": "obj_plant", "params": {"visible": False}},
            ],
            "label": "Nudge apple",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body["touched"]) == {"obj_apple", "obj_plant"}
    apple = next(o for o in body["scene"]["objects"] if o["id"] == "obj_apple")
    assert apple["transform"]["position"] == [1.0, 0.9, -1.4]
    assert apple["version"] == 2


def test_invalid_operation_is_rejected(client: TestClient, scene: dict) -> None:
    response = client.post(
        f"/api/v1/scenes/{scene['id']}/objects:apply",
        json={"operations": [{"op": "teleport", "target_id": "obj_apple", "params": {}}]},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "operation_failed"


def test_versions_are_listed_and_restorable(client: TestClient, scene: dict) -> None:
    edit = client.post(
        f"/api/v1/scenes/{scene['id']}/objects:apply",
        json={"operations": [{"op": "rename", "target_id": "obj_apple", "params": {"name": "Green apple"}}]},
    )
    assert edit.status_code == 200

    versions = client.get(f"/api/v1/scenes/{scene['id']}/versions").json()
    assert len(versions) >= 2
    original = versions[-1]

    restored = client.post(f"/api/v1/scenes/{scene['id']}/versions/{original['id']}:restore")
    assert restored.status_code == 200
    names = {o["name"] for o in restored.json()["scene"]["objects"]}
    assert "Red apple" in names
