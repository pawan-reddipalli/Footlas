from datetime import date

import pytest

from app.core.entitlements import has_entitlement
from app.domains.users.models import UserProgress
from app.domains.users.service import level_for, live_streak, update_streak


@pytest.mark.parametrize(
    ("xp", "level", "into", "needed"),
    [(0, 1, 0, 100), (99, 1, 99, 100), (100, 2, 0, 200), (299, 2, 199, 200), (300, 3, 0, 300)],
)
def test_levels(xp, level, into, needed):
    info = level_for(xp)
    assert (info.level, info.xp_into_level, info.xp_for_next) == (level, into, needed)


def test_streak_grows_on_consecutive_days_and_resets_after_a_gap():
    p = UserProgress(current_streak=0, longest_streak=0)
    assert update_streak(p, date(2026, 1, 1))
    assert update_streak(p, date(2026, 1, 2))
    assert not update_streak(p, date(2026, 1, 2))  # same day counts once
    assert (p.current_streak, p.longest_streak) == (2, 2)

    update_streak(p, date(2026, 1, 5))
    assert (p.current_streak, p.longest_streak) == (1, 2)


def test_live_streak_lapses_after_a_missed_day():
    p = UserProgress(current_streak=4, longest_streak=4, last_daily_date=date(2026, 1, 10))
    assert live_streak(p, date(2026, 1, 11)) == 4
    assert live_streak(p, date(2026, 1, 12)) == 0


def test_paid_plans_never_unlock_gameplay():
    assert not has_entitlement("free", "supporter_badge")
    assert has_entitlement("pro", "ai_coach")
    assert not has_entitlement("unknown-plan", "supporter_badge")
