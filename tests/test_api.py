from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app, store

client = TestClient(app)


def setup_function() -> None:
    store.shocks.clear()
    store.intake_drafts.clear()
    store.profiles.clear()
    store.impact_results.clear()
    store.scenarios.clear()
    store.scenario_results.clear()
    store.decisions.clear()


def provenance(status: str = "pending") -> list[dict[str, str]]:
    return [{
        "source_name": "Approved source placeholder",
        "source_url_or_reference": "source-reference",
        "retrieved_at": "2026-10-03T00:00:00Z",
        "verification_status": status,
    }]


def shock_payload(status: str = "pending") -> dict[str, object]:
    return {
        "shock_type": "exchange_rate",
        "economic_variable": "USD/PKR",
        "direction_or_change": "increase",
        "magnitude": "5",
        "unit": "percent",
        "observed_or_effective_date": "2026-10-03",
        "provenance": provenance(status),
        "verification_status": status,
    }


def make_shock(status: str = "pending") -> dict[str, object]:
    response = client.post("/api/v1/shocks", json=shock_payload(status))
    assert response.status_code == 201
    return response.json()


def confirmed_profile_id(business_id: object) -> str:
    draft = client.post(
        f"/api/v1/businesses/{business_id}/intake-drafts",
        json={
            "submitted_fields": {
                "sales_quantity": {"value": "1000", "unit": "units"},
                "selling_price_per_unit": {"value": "200", "unit": "PKR_per_unit"},
                "imported_quantity": {"value": "400", "unit": "units"},
                "imported_unit_cost": {"value": "50", "unit": "foreign_currency_per_unit"},
                "exchange_rate": {"value": "280", "unit": "PKR_per_foreign_currency"},
                "local_input_cost": {"value": "20000", "unit": "PKR"},
                "operating_expenses": {"value": "30000", "unit": "PKR"},
                "exchange_rate_change": {"value": "5", "unit": "percent"},
            }
        },
    ).json()
    response = client.post(f"/api/v1/businesses/{business_id}/intake-drafts/{draft['id']}/confirm")
    assert response.status_code == 200
    return response.json()["id"]


def scenario_payload() -> dict[str, object]:
    return {
        "business_id": str(uuid4()),
        "base_impact_result_id": str(uuid4()),
        "name": "Owner scenario",
        "changed_assumptions": [{"field_reference": "price_change", "value": "4", "unit": "percent"}],
    }


def test_shock_requires_provenance_and_rejects_business_scope() -> None:
    missing = shock_payload()
    missing["provenance"] = []
    response = client.post("/api/v1/shocks", json=missing)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"

    scoped = shock_payload()
    scoped["business_id"] = str(uuid4())
    response = client.post("/api/v1/shocks", json=scoped)
    assert response.status_code == 400


def test_intake_draft_confirmation_creates_confirmed_profile() -> None:
    business_id = uuid4()
    response = client.post(
        f"/api/v1/businesses/{business_id}/intake-drafts",
        json={"submitted_fields": {"material_cost": {"value": "100", "unit": "PKR"}}},
    )
    assert response.status_code == 201
    draft = response.json()
    assert draft["intake_status"] == "draft"

    confirmed = client.post(f"/api/v1/businesses/{business_id}/intake-drafts/{draft['id']}/confirm")
    assert confirmed.status_code == 200
    profile = confirmed.json()
    assert profile["business_confirmation_status"] == "confirmed"
    assert profile["confirmed_fields"]["material_cost"]["value"] == "100"


def test_invalid_business_intake_is_standard_error() -> None:
    response = client.post(f"/api/v1/businesses/{uuid4()}/intake-drafts", json={"submitted_fields": {}})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_trace_accepts_pending_shock_but_quantify_blocks_it() -> None:
    shock = make_shock("pending")
    business_id = uuid4()
    profile_id = confirmed_profile_id(business_id)

    trace = client.post(
        "/api/v1/impact-mappings",
        json={
            "shock_event_id": shock["id"],
            "business_id": str(business_id),
        },
    )

    assert trace.status_code == 200
    assert "nodes" in trace.json()
    assert "edges" in trace.json()

    quantify = client.post(
        "/api/v1/impact-results",
        json={
            "shock_event_id": shock["id"],
            "impact_mapping_id": str(uuid4()),
            "business_input_ids": [profile_id],
        },
    )

    assert quantify.status_code == 422
    assert quantify.json()["error"]["code"] == "VERIFICATION_REQUIRED"



def test_verified_quantify_routes_to_member_three_interface() -> None:
    shock = make_shock("verified")
    profile_id = confirmed_profile_id(uuid4())

    response = client.post(
        "/api/v1/impact-results",
        json={
            "shock_event_id": shock["id"],
            "impact_mapping_id": str(uuid4()),
            "business_input_ids": [profile_id],
            "assumption_ids": [],
        },
    )

    assert response.status_code == 200

    body = response.json()
    assert body["shock_event_id"] == shock["id"]
    assert body["impact_mapping_id"] is not None
    assert body["shock_event_id"] == shock["id"]
    assert "result" in body
    assert "baseline_revenue" in body["result"]
    assert "shocked_imported_cost" in body["result"]
    assert "profit_impact" in body["result"]


def test_scenario_requires_confirmation_and_edits_reset_to_draft() -> None:
    created = client.post("/api/v1/scenarios", json=scenario_payload())
    assert created.status_code == 201
    scenario_id = created.json()["id"]

    blocked = client.post(f"/api/v1/scenarios/{scenario_id}/run")
    assert blocked.status_code == 422
    assert blocked.json()["error"]["code"] == "APPROVAL_REQUIRED"

    confirmed = client.post(f"/api/v1/scenarios/{scenario_id}/confirm")
    assert confirmed.json()["assumption_confirmation_status"] == "confirmed"
    edited = client.patch(f"/api/v1/scenarios/{scenario_id}", json={"name": "Revised owner scenario"})
    assert edited.status_code == 200
    assert edited.json()["assumption_confirmation_status"] == "draft"


def test_simulate_executes_confirmed_scenario_from_quantify_result() -> None:
    business_id = uuid4()

    # Reuse the canonical confirmed business-profile fixture.
    profile_id = confirmed_profile_id(business_id)

    # Create a verified economic shock.
    shock = make_shock(status="verified")

    # QUANTIFY creates the baseline impact result.
    impact_response = client.post(
        "/api/v1/impact-results",
        json={
            "shock_event_id": shock["id"],
            "impact_mapping_id": str(uuid4()),
            "business_input_ids": [profile_id],
            "assumption_ids": [],
        },
    )
    assert impact_response.status_code == 200

    impact_body = impact_response.json()
    impact_result_id = impact_body["id"]

    assert impact_body["business_id"] == str(business_id)
    assert impact_body["shock_event_id"] == shock["id"]
    assert "result" in impact_body

    baseline_revenue = impact_body["result"]["baseline_revenue"]

    # Create a scenario using a currently supported deterministic
    # scenario field.
    scenario_response = client.post(
        "/api/v1/scenarios",
        json={
            "business_id": str(business_id),
            "base_impact_result_id": impact_result_id,
            "name": "Increase selling price",
            "changed_assumptions": [
                {
                    "field_reference": "selling_price_per_unit",
                    "value": "208",
                    "unit": "PKR_per_unit",
                }
            ],
        },
    )
    assert scenario_response.status_code == 201

    scenario_id = scenario_response.json()["id"]

    # Scenario execution must be blocked before owner confirmation.
    blocked = client.post(
        f"/api/v1/scenarios/{scenario_id}/run"
    )
    assert blocked.status_code == 422
    assert blocked.json()["error"]["code"] == "APPROVAL_REQUIRED"

    # Owner explicitly confirms the scenario.
    confirmation = client.post(
        f"/api/v1/scenarios/{scenario_id}/confirm"
    )
    assert confirmation.status_code == 200
    assert confirmation.json()["assumption_confirmation_status"] == "confirmed"

    # Execute SIMULATE.
    result_response = client.post(
        f"/api/v1/scenarios/{scenario_id}/run"
    )
    assert result_response.status_code == 200

    result_body = result_response.json()

    assert result_body["scenario_id"] == scenario_id
    assert result_body["business_id"] == str(business_id)
    assert result_body["base_impact_result_id"] == impact_result_id
    assert "result" in result_body

    # Original QUANTIFY baseline remains intact.
    assert result_body["result"]["baseline"]["baseline_revenue"] == baseline_revenue

    # Price changes from 200 to 208, so projected revenue increases.
    assert result_body["result"]["projected"]["shocked_revenue"] > baseline_revenue

def test_owner_decision_requires_explicit_confirmation() -> None:
    decision = client.post(
        "/api/v1/decisions",
        json={"business_id": str(uuid4()), "comparison_set_id": str(uuid4()), "owner_defined_response": "Owner response"},
    )
    assert decision.status_code == 201, decision.text
    assert decision.json()["decision_status"] == "selected"
    confirmed = client.post(
        f"/api/v1/decisions/{decision.json()['id']}/confirm",
        json={"owner_confirmation_reference": "owner-confirmed"},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["decision_status"] == "confirmed"


def test_monitoring_requires_confirmed_owner_decision() -> None:
    decision = client.post(
        "/api/v1/decisions",
        json={
            "business_id": str(uuid4()),
            "comparison_set_id": str(uuid4()),
            "owner_defined_response": "Owner response",
        },
    ).json()

    payload = {
        "business_id": decision["business_id"],
        "human_decision_id": decision["id"],
        "metric_name": "actual_cost",
        "actual_value": "100",
        "unit": "PKR",
        "observed_at": "2026-10-03T00:00:00Z",
        "provenance_or_business_input_reference": "owner-input",
    }

    blocked = client.post("/api/v1/monitoring-records", json=payload)
    assert blocked.status_code == 422
    assert blocked.json()["error"]["code"] == "APPROVAL_REQUIRED"

    client.post(
        f"/api/v1/decisions/{decision['id']}/confirm",
        json={"owner_confirmation_reference": "confirmed"},
    )

    delegated = client.post("/api/v1/monitoring-records", json=payload)
    assert delegated.status_code == 422
    assert delegated.json()["error"]["code"] == "CLARIFICATION_REQUIRED"
def test_monitoring_evaluates_confirmed_selected_scenario() -> None:
    business_id = uuid4()

    # Reuse the existing confirmed business-profile fixture.
    profile_id = confirmed_profile_id(business_id)

    # Create a verified economic shock.
    shock = make_shock(status="verified")

    # QUANTIFY creates the baseline impact result.
    impact_response = client.post(
        "/api/v1/impact-results",
        json={
            "shock_event_id": shock["id"],
            "impact_mapping_id": str(uuid4()),
            "business_input_ids": [profile_id],
            "assumption_ids": [],
        },
    )
    assert impact_response.status_code == 200

    impact_body = impact_response.json()
    impact_result_id = impact_body["id"]

    # Create a scenario.
    scenario_response = client.post(
        "/api/v1/scenarios",
        json={
            "business_id": str(business_id),
            "base_impact_result_id": impact_result_id,
            "name": "Monitoring Scenario",
            "changed_assumptions": [
                {
                    "field_reference": "selling_price_per_unit",
                    "value": "208",
                    "unit": "PKR_per_unit",
                }
            ],
        },
    )
    assert scenario_response.status_code == 201

    scenario_id = scenario_response.json()["id"]

    # Confirm the scenario.
    confirmation = client.post(
        f"/api/v1/scenarios/{scenario_id}/confirm"
    )
    assert confirmation.status_code == 200
    assert confirmation.json()["assumption_confirmation_status"] == "confirmed"

    # Run the scenario.
    scenario_run = client.post(
        f"/api/v1/scenarios/{scenario_id}/run"
    )
    assert scenario_run.status_code == 200

    # Create an owner decision selecting this scenario.
    decision = client.post(
        "/api/v1/decisions",
        json={
    "business_id": str(business_id),
    "comparison_set_id": str(uuid4()),
    "selected_scenario_id": scenario_id,
},
    )
    assert decision.status_code == 201, decision.text

    decision_id = decision.json()["id"]

    # Confirm the owner's decision.
    confirmed_decision = client.post(
        f"/api/v1/decisions/{decision_id}/confirm",
        json={"owner_confirmation_reference": "owner-confirmed"},
    )
    assert confirmed_decision.status_code == 200

    # Record an actual result.
    monitoring = client.post(
        "/api/v1/monitoring-records",
        json={
            "business_id": str(business_id),
            "human_decision_id": decision_id,
            "metric_name": "gross_profit",
            "actual_value": "10000",
            "unit": "PKR",
            "observed_at": "2026-10-03T00:00:00Z",
            "provenance_or_business_input_reference": "owner-input",
        },
    )

    assert monitoring.status_code == 200

    monitoring_body = monitoring.json()

    assert monitoring_body["metric_name"] == "gross_profit"
    assert "projected_value" in monitoring_body
    assert "actual_value" in monitoring_body
    assert "variance" in monitoring_body
    assert "variance_pct" in monitoring_body
    assert monitoring_body["status"] in {
        "ON_TRACK",
        "VARIANCE_DETECTED",
        "REASSESSMENT_REQUIRED",
    }
