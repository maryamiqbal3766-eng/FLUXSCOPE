"""Shared helpers that drive the API through the real workflow path.

A verified shock can only come from the DETECT evidence verifier, so tests
obtain one by running POST /detect with a deterministic fake LLM (no
network) and registering the verified candidate.
"""

import json
from contextlib import contextmanager
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app, economic_extractor

client = TestClient(app)

APPROVED_PUBLISHER = "State Bank of Pakistan"
APPROVED_URL = "https://www.sbp.org.pk/press-release"

FX_SOURCE_TEXT = (
    "The State Bank of Pakistan reported that the USD/PKR exchange rate "
    "increased by 5 percent during the period."
)

FX_EXTRACTION = {
    "shock_type": "exchange_rate",
    "variable": "exchange rate",
    "direction_or_change": "increase",
    "magnitude": 5,
    "unit": "percent",
    "effective_date": "2026-10-03",
    "potential_dependencies": [],
}


class FakeLLM:
    """Returns a fixed JSON extraction; records the evidence it was given."""

    def __init__(self, items: list[dict]):
        self.items = items
        self.prompts: list[str] = []

    def complete(self, messages):
        self.prompts.append(messages[-1]["content"])
        return json.dumps(self.items)


@contextmanager
def fake_extraction(items: list[dict]):
    original = economic_extractor.llm
    fake = FakeLLM(items)
    economic_extractor.llm = fake
    try:
        yield fake
    finally:
        economic_extractor.llm = original


def detect(items: list[dict], *, content: str = FX_SOURCE_TEXT, **source_fields) -> list[dict]:
    payload = {
        "title": "SBP statement",
        "publisher": APPROVED_PUBLISHER,
        "source_url": APPROVED_URL,
        "content": content,
        **source_fields,
    }
    with fake_extraction(items):
        response = client.post("/api/v1/detect", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def register_detected(shock_id: str):
    return client.post(f"/api/v1/shocks/from-detection/{shock_id}")


def make_verified_shock(extraction: dict | None = None, *, content: str = FX_SOURCE_TEXT) -> dict:
    candidates = detect([extraction or FX_EXTRACTION], content=content)
    assert len(candidates) == 1
    assert candidates[0]["verification_status"] == "VERIFIED", candidates[0]
    response = register_detected(candidates[0]["shock_id"])
    assert response.status_code == 201, response.text
    shock = response.json()
    assert shock["verification_status"] == "verified"
    return shock


def make_pending_shock() -> dict:
    response = client.post(
        "/api/v1/shocks",
        json={
            "shock_type": "exchange_rate",
            "economic_variable": "USD/PKR",
            "direction_or_change": "increase",
            "magnitude": "5",
            "unit": "percent",
            "observed_or_effective_date": "2026-10-03",
            "provenance": [{
                "source_name": "Approved source placeholder",
                "source_url_or_reference": "source-reference",
                "retrieved_at": "2026-10-03T00:00:00Z",
                "verification_status": "pending",
            }],
            "verification_status": "pending",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


BUSINESS_FACTS = {
    "sales_quantity": {"value": "1000", "unit": "units"},
    "selling_price_per_unit": {"value": "200", "unit": "PKR_per_unit"},
    "imported_quantity": {"value": "400", "unit": "units"},
    "imported_unit_cost": {"value": "50", "unit": "foreign_currency_per_unit"},
    "exchange_rate": {"value": "280", "unit": "PKR_per_foreign_currency"},
    "local_input_cost": {"value": "20000", "unit": "PKR"},
    "operating_expenses": {"value": "30000", "unit": "PKR"},
}


def confirm_profile(business_id, facts: dict | None = None) -> str:
    draft = client.post(
        f"/api/v1/businesses/{business_id}/intake-drafts",
        json={"submitted_fields": facts or BUSINESS_FACTS},
    )
    assert draft.status_code == 201, draft.text
    response = client.post(
        f"/api/v1/businesses/{business_id}/intake-drafts/{draft.json()['id']}/confirm"
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def make_mapping(shock_id: str, business_id) -> str:
    response = client.post(
        "/api/v1/impact-mappings",
        json={"shock_event_id": shock_id, "business_id": str(business_id)},
    )
    assert response.status_code == 200, response.text
    return response.json()["id"]


def quantify(shock_id: str, mapping_id: str, profile_id: str):
    return client.post(
        "/api/v1/impact-results",
        json={
            "shock_event_id": shock_id,
            "impact_mapping_id": mapping_id,
            "business_input_ids": [profile_id],
            "assumption_ids": [],
        },
    )


def new_business_id():
    return uuid4()
