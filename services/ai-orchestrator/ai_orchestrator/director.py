"""AI Scene Director (deterministic): description -> structured scene plan.

Produces cast, props, environment, beats, shots and the scene operations needed
to build the set. It never returns executable code, and it never fabricates a
character: characters are named roles to be cast from the character library.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

CHARACTER_WORDS = [
    ("young woman", "Young woman", "adult"),
    ("young man", "Young man", "adult"),
    ("old man", "Elderly man", "senior"),
    ("detective", "Detective", "adult"),
    ("woman", "Woman", "adult"),
    ("girl", "Girl", "teen"),
    ("boy", "Boy", "teen"),
    ("child", "Child", "child"),
    ("man", "Man", "adult"),
    ("robot", "Robot", "unspecified"),
]

PROP_WORDS = [
    ("apple", "Apple", "picked up and bitten"),
    ("bottle", "Bottle", "poured"),
    ("phone", "Phone", "picked up"),
    ("letter", "Letter", "read"),
    ("knife", "Knife", "picked up"),
    ("book", "Book", "opened"),
    ("door", "Door", "opened"),
    ("cup", "Cup", "picked up"),
    ("mug", "Mug", "picked up"),
    ("key", "Key", "picked up"),
]

ENV_WORDS = [
    ("laboratory", "room.lab.futuristic", "interior", "A futuristic laboratory"),
    ("kitchen", "room.kitchen.modern", "interior", "A modern kitchen"),
    ("office", "room.office.open", "interior", "An open-plan office"),
    ("street", "urban.street.narrow", "exterior", "A narrow street"),
    ("forest", "landscape.forest.temperate", "exterior", "A temperate forest"),
    ("beach", "landscape.beach.tropical", "exterior", "A tropical beach"),
    ("desert", "landscape.desert.dunes", "exterior", "Desert dunes"),
    ("city", "urban.city.downtown", "exterior", "A city centre"),
    ("lab", "room.lab.futuristic", "interior", "A futuristic laboratory"),
    ("room", "room.domestic.small", "interior", "A small domestic room"),
]

ACTION_VERBS = [
    ("enters", "enters"),
    ("enter", "enters"),
    ("walks", "walks towards"),
    ("runs", "runs towards"),
    ("picks up", "picks up"),
    ("takes a bite", "bites into"),
    ("sits", "sits on"),
    ("opens", "opens"),
    ("closes", "closes"),
    ("looks at", "looks at"),
    ("turns", "turns towards"),
    ("puts down", "puts down"),
    ("reads", "reads"),
    ("throws", "throws"),
]

STYLE_WORDS = [
    ("cinematic", "cinematic"),
    ("photoreal", "photoreal"),
    ("anime", "anime"),
    ("noir", "noir"),
    ("clay", "clay_render"),
    ("low poly", "low_poly"),
    ("stylised", "stylised"),
]

TIME_WORDS = ["dawn", "morning", "noon", "afternoon", "sunset", "dusk", "night"]

SHOT_TYPES = ["wide", "medium", "medium", "close_up", "close_up", "over_the_shoulder", "medium"]
MOVEMENTS = ["dolly", "truck", "static", "dolly", "static", "orbit", "static"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def _title(text: str) -> str:
    return re.sub(r"\b\w", lambda m: m.group(0).upper(), text)


def plan_scene(prompt: str, fps: int = 24, seconds: int = 10) -> dict[str, Any]:
    lower = prompt.lower()
    warnings: list[str] = []

    characters: list[dict[str, Any]] = []
    matched: list[str] = []
    for word, label, age in sorted(CHARACTER_WORDS, key=lambda c: len(c[0]), reverse=True):
        if any(word in m for m in matched):
            continue
        if re.search(rf"\b{word}\b", lower) and not any(c["name"] == label.replace(" ", "_") for c in characters):
            matched.append(word)
            characters.append(
                {
                    "name": label.replace(" ", "_"),
                    "description": f'{label} matching the prompt: "{prompt[:120]}"',
                    "role": "lead" if not characters else "support",
                    "age_band": age,
                }
            )
    if not characters:
        characters.append(
            {"name": "Character_Lead", "description": "Unspecified lead character", "role": "lead", "age_band": "unspecified"}
        )
        warnings.append("No character was named; a generic lead was cast. Assign a character profile in the Character Studio.")

    props: list[dict[str, Any]] = [
        {"name": label, "description": f"A {word} named in the prompt", "interaction": interaction}
        for word, label, interaction in PROP_WORDS
        if re.search(rf"\b{word}\b", lower)
    ]
    if not props:
        warnings.append("No interactable prop was named; the plan contains performance-only beats.")

    env = next((e for e in ENV_WORDS if re.search(rf"\b{e[0]}\b", lower)), None)
    if env is None:
        env = ("room", "room.domestic.small", "interior", "An unspecified interior")
        warnings.append("Environment was not specified; defaulted to a neutral interior set.")

    time_of_day = next((t for t in TIME_WORDS if t in lower), "afternoon")
    style = next((s for w, s in STYLE_WORDS if w in lower), "cinematic")

    beats: list[str] = []
    for word, beat in ACTION_VERBS:
        if word in lower:
            target = props[0]["name"].lower() if props else "object"
            beats.append(f"{beat} the {target}" if beat in {"picks up", "bites into", "opens", "puts down"} else beat)
    beats = list(dict.fromkeys(beats))
    if not beats:
        beats = ["holds the pose", "reacts", "exits frame"]
        warnings.append("No action verb was recognised; generic performance beats were used.")

    seconds_per_shot = max(2, round(seconds / (len(beats) + 1)))
    frames_per_shot = seconds_per_shot * fps
    names = ["Establishing"] + [_title(b) for b in beats]

    shots = []
    for i, name in enumerate(names):
        shots.append(
            {
                "index": i,
                "name": name,
                "description": (
                    f"Establishing shot of {env[3].lower()}, {time_of_day} light."
                    if i == 0
                    else f"{_title(beats[i - 1])} - framed as a {SHOT_TYPES[i % len(SHOT_TYPES)].replace('_', ' ')}."
                ),
                "camera_shot_type": SHOT_TYPES[i % len(SHOT_TYPES)],
                "camera_movement": MOVEMENTS[i % len(MOVEMENTS)],
                "start_frame": i * frames_per_shot,
                "end_frame": (i + 1) * frames_per_shot,
                "subjects": [characters[0]["name"]] + ([props[0]["name"]] if props else []),
                "lighting_note": f"{time_of_day} key light, warm practical fill",
                "audio_note": "room tone, low score in" if i == 0 else "dialogue-free action, score continues",
                "transition_in": "fade" if i == 0 else "cut",
            }
        )

    operations: list[dict[str, Any]] = [
        {
            "op": "set_environment",
            "target_id": None,
            "params": {
                "patch": {
                    "preset_id": env[1],
                    "kind": env[2],
                    "time_of_day": time_of_day,
                    "global_style": style,
                }
            },
        }
    ]
    for i, prop in enumerate(props):
        operations.append(
            {
                "op": "add_object",
                "target_id": None,
                "params": {
                    "object": {
                        "name": prop["name"],
                        "type": "prop",
                        "tags": ["plan", "prop", prop["name"].lower()],
                        "transform": {"position": [1.0 - i * 0.4, 0.8, -1.2]},
                    },
                    "parent_id": None,
                },
            }
        )
    for shot in shots:
        operations.append(
            {
                "op": "set_shot",
                "target_id": None,
                "params": {
                    "shot": {
                        "id": _new_id("shot"),
                        "index": shot["index"],
                        "name": shot["name"],
                        "camera_id": None,
                        "start_frame": shot["start_frame"],
                        "end_frame": shot["end_frame"],
                        "description": shot["description"],
                        "subjects": [],
                        "transition_in": shot["transition_in"],
                    }
                },
            }
        )

    return {
        "id": _new_id("dirplan"),
        "prompt": prompt,
        "logline": f'{characters[0]["name"].replace("_", " ")} ' + ", then ".join(beats) + f' in {env[3].lower()}.',
        "characters": characters,
        "props": props,
        "environment": {
            "preset_id": env[1],
            "kind": env[2],
            "time_of_day": time_of_day,
            "description": env[3],
        },
        "beats": beats,
        "shots": shots,
        "total_frames": len(shots) * frames_per_shot,
        "fps": fps,
        "style": style,
        "warnings": warnings,
        "producer": {"kind": "deterministic", "model_id": None},
        "operations": operations,
        "created_at": _now(),
    }
