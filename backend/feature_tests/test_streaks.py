"""Streaks: +1 for each consecutive UTC day the daily challenge is finished."""

from feature_tests.helpers import correct_answer, play_daily


def _streak(client) -> tuple[int, int]:
    p = client.get("/api/me").json()["progress"]
    return p["streak"], p["longest_streak"]


def test_streak_grows_over_consecutive_days(client, db, clock):
    for expected in (1, 2, 3):
        last = play_daily(client, db, correct=3)
        assert last["progress"]["streak"] == expected
        assert _streak(client) == (expected, expected)
        clock.advance()


def test_streak_stays_alive_until_a_whole_day_is_missed(client, db, clock):
    play_daily(client, db)
    clock.advance()  # the next day, not played yet: still alive
    assert _streak(client) == (1, 1)
    clock.advance()  # a whole day missed
    assert _streak(client) == (0, 1)


def test_streak_resets_after_a_missed_day_but_best_is_kept(client, db, clock):
    for _ in range(3):
        play_daily(client, db)
        clock.advance()
    clock.advance()  # skip a day
    last = play_daily(client, db)
    assert last["progress"]["streak"] == 1 and last["progress"]["longest_streak"] == 3
    assert _streak(client) == (1, 3)


def test_unfinished_daily_does_not_count(client, db, clock):
    items = client.get("/api/daily").json()["items"]
    for item in items[:9]:
        qid = item["question"]["id"]
        client.post(
            "/api/daily/answer", json={"question_id": qid, "answer": correct_answer(db, qid)}
        )
    assert _streak(client) == (0, 0)


def test_practice_does_not_build_a_streak(client, db, clock):
    q = client.get("/api/practice/next", params={"mode": "map"}).json()
    client.post(
        "/api/practice/answer", json={"question_id": q["id"], "answer": correct_answer(db, q["id"])}
    )
    assert _streak(client) == (0, 0)
