"""Checks the Claude plan path without calling the real API."""

import json
import sys
import types

from app.config import settings
from app.services import plan as plan_service
from app.services.report import build_report


class _FakeMessages:
    def __init__(self, reply: str):
        self.reply = reply

    def create(self, **kwargs):
        block = types.SimpleNamespace(type="text", text=self.reply)
        return types.SimpleNamespace(content=[block])


def _install_fake_anthropic(monkeypatch, reply: str):
    fake = types.ModuleType("anthropic")
    fake.Anthropic = lambda api_key=None: types.SimpleNamespace(messages=_FakeMessages(reply))
    monkeypatch.setitem(sys.modules, "anthropic", fake)
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    plan_service._cache.clear()


def test_claude_plan_uses_catalog_links(monkeypatch):
    reply = json.dumps({
        "summary": "Your block runs hot. Here is what helps most.",
        "actions": [
            {"program_id": "street_tree", "why": "Shade would cool your sidewalk."},
            {"program_id": "cooling_centers", "why": "Cool off on the worst days."},
            {"program_id": "made_up_program", "why": "Should be dropped."},
            {"program_id": "heat_alerts", "why": "Know before a heat wave."},
            {"program_id": "community_solar", "why": "Lower your bill."},
        ],
    })
    _install_fake_anthropic(monkeypatch, "```json\n" + reply + "\n```")
    p = plan_service.build_plan(build_report("sample-chinatown"), "renter")
    assert p.generated_by == "claude"
    assert [a.program_id for a in p.actions] == ["street_tree", "cooling_centers", "heat_alerts", "community_solar"]
    assert p.actions[0].cta_label == "Request from the City"  # from the catalog, not the AI


def test_bad_ai_reply_falls_back_to_rules(monkeypatch):
    _install_fake_anthropic(monkeypatch, "sorry, no JSON here")
    p = plan_service.build_plan(build_report("sample-chinatown"), "owner")
    assert p.generated_by == "rules"
    assert len(p.actions) == 4
