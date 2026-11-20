"""Profiles: who you are, your stats, and renaming."""

import pytest

from feature_tests.conftest import make_client
from feature_tests.helpers import play_daily, practice, question_by_key, wrong_answer


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/me"),
        ("patch", "/api/me"),
        ("get", "/api/daily"),
        ("get", "/api/practice/next?mode=map"),
        ("post", "/api/practice/answer"),
        ("get", "/api/auth/session"),
    ],
)
def test_requests_without_identity_get_401(client, method, path):
    client.headers.pop("X-Dev-User")
    assert client.request(method, path, json={}).status_code == 401


def test_new_profile_starts_empty(client):
    me = client.get("/api/me").json()
    assert me["username"] == "tester" and me["plan"] == "free" and me["entitlements"] == []
    assert me["progress"] == {
        "xp": 0,
        "level": 1,
        "xp_into_level": 0,
        "xp_for_next": 100,
        "streak": 0,
        "longest_streak": 0,
    }
    assert me["stats"] == {
        "answered": 0,
        "correct": 0,
        "accuracy": None,
        "by_mode": {},
        "daily_completed": 0,
    }
    assert me["joined_at"]


def test_stats_count_answers_accuracy_and_modes(client, db, clock):
    fra = question_by_key(db, "country_locate:FRA")
    kane = question_by_key(db, "who_am_i:harry-kane")
    practice(client, fra.id, "250")
    practice(client, fra.id, wrong_answer(db, fra.id))
    practice(client, kane.id, wrong_answer(db, kane.id))

    stats = client.get("/api/me").json()["stats"]
    assert (stats["answered"], stats["correct"], stats["accuracy"]) == (3, 1, 33)
    assert stats["by_mode"] == {
        "map": {"answered": 2, "correct": 1},
        "player": {"answered": 1, "correct": 0},
    }

    play_daily(client, db, correct=10)
    stats = client.get("/api/me").json()["stats"]
    assert stats["answered"] == 13 and stats["correct"] == 11 and stats["daily_completed"] == 1
    assert stats["by_mode"]["map"]["answered"] == 2 + 6
    assert stats["by_mode"]["player"]["answered"] == 1 + 4


def test_each_identity_gets_its_own_profile(client, db):
    fra = question_by_key(db, "country_locate:FRA")
    practice(client, fra.id, "250")
    other = make_client("someone-else").get("/api/me").json()
    assert other["username"] == "someone-else" and other["stats"]["answered"] == 0
    assert client.get("/api/me").json()["stats"]["answered"] == 1


@pytest.mark.parametrize("bad", ["ab", "x" * 33, "has space", "emoji⚽", "semi;colon", ""])
def test_rename_rejects_invalid_usernames(client, bad):
    res = client.patch("/api/me", json={"username": bad})
    assert res.status_code == 400 and res.json()["detail"]
    assert client.get("/api/me").json()["username"] == "tester"


def test_rename_trims_spaces_and_keeps_stats(client, db):
    practice(client, question_by_key(db, "country_locate:FRA").id, "250")
    body = client.patch("/api/me", json={"username": "  pawan.10-x_  "}).json()
    assert body["username"] == "pawan.10-x_"
    assert body["stats"]["answered"] == 1
    assert client.get("/api/me").json()["username"] == "pawan.10-x_"


def test_usernames_are_unique(client):
    make_client("taken_name").get("/api/me")  # creates a user called taken_name
    res = client.patch("/api/me", json={"username": "taken_name"})
    assert res.status_code == 400 and "taken" in res.json()["detail"]
    # Renaming to the name you already have is fine.
    assert client.patch("/api/me", json={"username": "tester"}).status_code == 200


def test_session_endpoint_reports_dev_identity(client):
    body = client.get("/api/auth/session").json()
    assert body["auth_mode"] == "dev" and body["auth_id"] == "dev:tester"
    assert body["username"] == "tester" and isinstance(body["user_id"], int)
