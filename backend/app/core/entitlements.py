"""What each plan unlocks.

Footlas keeps learning free: every game, question, streak and achievement works on the
free plan. Paid plans only add cosmetics and optional extras, so nothing here may ever
gate gameplay. When payments arrive (e.g. a Stripe webhook), it sets `User.plan` and
every check below follows.
"""

FREE: frozenset[str] = frozenset()

PLAN_ENTITLEMENTS: dict[str, frozenset[str]] = {
    "free": FREE,
    # One-off or recurring supporters (Phase 6, "Support the Developer").
    "supporter": frozenset({"supporter_badge"}),
    # Optional subscription (Phase 7): cosmetics and AI extras, never gameplay advantages.
    "pro": frozenset({"supporter_badge", "cosmetic_themes", "ai_coach"}),
}


def entitlements_for(plan: str) -> frozenset[str]:
    return PLAN_ENTITLEMENTS.get(plan, FREE)


def has_entitlement(plan: str, entitlement: str) -> bool:
    return entitlement in entitlements_for(plan)
