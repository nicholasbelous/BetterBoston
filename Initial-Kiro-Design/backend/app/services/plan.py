"""The action plan.

Claude picks 4 programs from app/data/programs.json and writes a 2-sentence summary plus one
"why this matters for your block" line per action. Titles, buttons and links always come from the
catalog, so the AI can't invent a program or a link. With no API key (or if the call fails),
a simple rule-based plan is returned instead, so the demo never breaks.
"""

from __future__ import annotations

import json
import logging
import re

from app.config import settings
from app.models import Plan, PlanAction, Report, Role
from app.services.data import program_by_id, programs

log = logging.getLogger(__name__)

_cache: dict[tuple[str, str], Plan] = {}

RENTER_ORDER = ["cooling_centers", "street_tree", "community_solar", "heat_alerts"]
OWNER_ORDER = ["heat_pump", "cool_roof", "yard_trees", "rooftop_solar", "cooling_centers", "street_tree", "heat_alerts"]


def _fill(text: str, report: Report) -> str:
    return text.replace("{canopy_pct}", str(round(report.trees.canopy_pct)))


def conditions(report: Report) -> set[str]:
    """Facts about the block that programs.json can key on (good_when / why_if)."""
    found = {"always"}
    if report.heat.score > 50:
        found.add("heat_high")
    if report.trees.score <= 25:
        found.add("trees_low")
    if report.roof_is_dark:
        found.add("roof_dark")
    return found


def _default_why(program: dict, report: Report) -> str:
    for condition, text in program.get("why_if", {}).items():
        if condition in conditions(report):
            return text
    return program["default_why"]


def _action(program: dict, report: Report, why: str | None = None) -> PlanAction:
    return PlanAction(
        program_id=program["id"],
        title=program["title"],
        why=_fill(why or _default_why(program, report), report),
        cta_label=program["cta_label"],
        cta_url=program["url"],
        tag=program["tag"],
        icon=program["icon"],
    )


def _hotter_phrase(report: Report) -> str:
    d = report.heat.delta_vs_city_f
    if d >= 1:
        return f"gets about {round(d)}°F hotter than the Boston average"
    if d <= -1:
        return f"stays about {round(abs(d))}°F cooler than the Boston average"
    return "gets about as hot as the Boston average"


def rules_plan(report: Report, role: Role) -> Plan:
    hot = "heat_high" in conditions(report)
    if role == "renter":
        order = RENTER_ORDER if hot else ["heat_alerts", "community_solar", "cooling_centers", "street_tree"]
    else:
        order = OWNER_ORDER
    chosen = []
    for pid in order:
        p = program_by_id(pid)
        if not p or role not in p["roles"]:
            continue
        if pid == "cool_roof" and not report.roof_is_dark:
            continue
        chosen.append(p)
        if len(chosen) == 4:
            break

    canopy = round(report.trees.canopy_pct)
    shade = f"trees shade only about {canopy}% of it" if "trees_low" in conditions(report) else f"trees shade about {canopy}% of it"
    if role == "renter":
        advice = (
            "As a renter, your fastest wins are knowing where to cool off and asking the City for a free street tree."
            if hot
            else "As a renter, heat alerts and community solar are easy ways to stay ready and save on your bill."
        )
        summary = f"Your block {_hotter_phrase(report)} on summer afternoons, and {shade}. {advice}"
    else:
        roof = ", and your roof looks dark from above" if report.roof_is_dark else f", and {shade}"
        summary = (
            f"Your block {_hotter_phrase(report)}{roof}. "
            "As an owner, upgrades like a heat pump can keep your home cooler, and Mass Save rebates can cover part of the cost."
        )
    return Plan(role=role, summary=summary, actions=[_action(p, report) for p in chosen], generated_by="rules")


SYSTEM_PROMPT = """You write short, friendly climate action plans for Massachusetts residents.
Rules:
- Plain language at an 8th-grade reading level. Calm and practical, never alarmist.
- Only recommend programs from the list you are given, by their id. Never invent programs, numbers, prices or links.
- Use the block's real numbers when helpful (temperature difference, tree cover %).
- Reply with JSON only, no other text, in exactly this shape:
{"summary": "<exactly 2 sentences>", "actions": [{"program_id": "<id>", "why": "<one sentence, under 22 words, about why it matters for THIS block>"}]}
- Exactly 4 actions, most useful first."""


def _claude_plan(report: Report, role: Role) -> Plan | None:
    if not settings.anthropic_api_key:
        return None
    try:
        from anthropic import Anthropic

        allowed = [p for p in programs() if role in p["roles"] and not (p["id"] == "cool_roof" and not report.roof_is_dark)]
        facts = {
            "role": role,
            "place": f"{report.location.label}, {report.location.city_line}",
            "heat_risk": {"score": report.heat.score, "label": report.heat.label,
                          "degrees_vs_boston_average_f": report.heat.delta_vs_city_f},
            "tree_cover": {"score": report.trees.score, "label": report.trees.label, "percent_of_block": report.trees.canopy_pct},
            "roof_looks_dark": report.roof_is_dark,
            "why_hot": [r.title for r in report.heat.reasons],
        }
        catalog = [{"id": p["id"], "title": p["title"], "about": _fill(_default_why(p, report), report)} for p in allowed]

        client = Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=700,
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"Block facts:\n{json.dumps(facts, indent=2)}\n\nPrograms you may use:\n{json.dumps(catalog, indent=2)}",
            }],
        )
        text = "".join(block.text for block in msg.content if block.type == "text")
        data = json.loads(re.search(r"\{.*\}", text, re.S).group(0))  # tolerate stray text or code fences

        allowed_ids = {p["id"] for p in allowed}
        actions = []
        for item in data["actions"]:
            pid = item.get("program_id")
            if pid in allowed_ids and pid not in {a.program_id for a in actions}:
                actions.append(_action(program_by_id(pid), report, item.get("why")))
        if len(actions) < 4 or not data.get("summary"):
            log.warning("Claude plan failed validation; using rules plan")
            return None
        return Plan(role=role, summary=data["summary"].strip(), actions=actions[:4], generated_by="claude")
    except Exception as exc:
        log.warning("Claude plan failed (%s); using rules plan", exc)
        return None


def build_plan(report: Report, role: Role) -> Plan:
    key = (report.location.block_id, role)
    if key not in _cache:
        _cache[key] = _claude_plan(report, role) or rules_plan(report, role)
    return _cache[key]
