"""Gates added for the end-to-end demo workflow.

Covers: source verification ownership, the DETECT -> TRACE hand-off,
shock-type gating, the TRACE -> QUANTIFY prerequisite, scenario-assumption
validation, and the COMPARE response.
"""

from uuid import uuid4

from app.main import economic_extractor
from app.services.groq import GroqConfigurationError
from workflow_helpers import (
    BUSINESS_FACTS,
    FX_EXTRACTION,
    FX_SOURCE_TEXT,
    client,
    confirm_profile,
    detect,
    make_mapping,
    make_pending_shock,
    make_verified_shock,
    quantify,
    register_detected,
)


def shock_body(status: str, provenance_status: str) -> dict:
    return {
        "shock_type": "exchange_rate",
        "economic_variable": "USD/PKR",
        "direction_or_change": "increase",
        "magnitude": "5",
        "unit": "percent",
        "observed_or_effective_date": "2026-10-03",
        "provenance": [{
            "source_name": "State Bank of Pakistan",
            "source_url_or_reference": "https://www.sbp.org.pk/anything",
            "retrieved_at": "2026-10-03T00:00:00Z",
            "verification_status": provenance_status,
        }],
        "verification_status": status,
    }


# ---------------------------------------------------------------------------
# Source verification
# ---------------------------------------------------------------------------


def test_caller_cannot_claim_a_verified_shock() -> None:
    response = client.post("/api/v1/shocks", json=shock_body("verified", "verified"))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VERIFICATION_REQUIRED"


def test_caller_cannot_claim_verified_provenance_on_a_pending_shock() -> None:
    response = client.post("/api/v1/shocks", json=shock_body("pending", "verified"))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VERIFICATION_REQUIRED"


def test_detect_rejects_unapproved_source_with_contract_error() -> None:
    with_fake = client.post(
        "/api/v1/detect",
        json={
            "title": "Blog post",
            "publisher": "State Bank of Pakistan",
            "source_url": "https://example.com/fx",
            "content": FX_SOURCE_TEXT,
        },
    )
    assert with_fake.status_code == 422
    body = with_fake.json()["error"]
    assert body["code"] == "VERIFICATION_REQUIRED"
    assert body["stage"] == "DETECT"


def test_detect_without_llm_configuration_is_upstream_unavailable() -> None:
    class Unconfigured:
        def complete(self, messages):
            raise GroqConfigurationError("GROQ_API_KEY is not configured.")

    original = economic_extractor.llm
    economic_extractor.llm = Unconfigured()
    try:
        response = client.post(
            "/api/v1/detect",
            json={
                "title": "SBP statement",
                "publisher": "State Bank of Pakistan",
                "source_url": "https://www.sbp.org.pk/press-release",
                "content": FX_SOURCE_TEXT,
            },
        )
    finally:
        economic_extractor.llm = original

    assert response.status_code == 424
    assert response.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"


def test_registered_detection_keeps_id_and_server_side_verification() -> None:
    candidates = detect([FX_EXTRACTION])
    candidate = candidates[0]
    assert candidate["verification_status"] == "VERIFIED"

    response = register_detected(candidate["shock_id"])
    assert response.status_code == 201
    shock = response.json()
    assert shock["id"] == candidate["shock_id"]
    assert shock["verification_status"] == "verified"
    assert shock["shock_type"] == "exchange_rate"
    assert shock["magnitude"] == "5"
    assert shock["provenance"][0]["source_name"] == "State Bank of Pakistan"
    assert shock["provenance"][0]["source_url_or_reference"] == "https://www.sbp.org.pk/press-release"

    # Registration is idempotent.
    again = register_detected(candidate["shock_id"])
    assert again.json()["id"] == shock["id"]


def test_register_unknown_detection_is_not_found() -> None:
    response = register_detected(str(uuid4()))
    assert response.status_code == 404


def test_magnitude_absent_from_evidence_is_rejected_and_cannot_be_traced() -> None:
    invented = {**FX_EXTRACTION, "magnitude": 9}
    candidate = detect([invented])[0]
    assert candidate["verification_status"] == "REJECTED"

    shock = register_detected(candidate["shock_id"]).json()
    assert shock["verification_status"] == "rejected"

    business_id = uuid4()
    confirm_profile(business_id)
    trace = client.post(
        "/api/v1/impact-mappings",
        json={"shock_event_id": shock["id"], "business_id": str(business_id)},
    )
    assert trace.status_code == 422
    assert trace.json()["error"]["code"] == "VERIFICATION_REQUIRED"


def test_detection_evidence_comes_only_from_the_submitted_source() -> None:
    first_text = "PBS reported that the exchange rate increased by 5 percent in the first release."
    second_text = "SBP stated that the exchange rate increased by 5 percent in the second statement."
    detect([FX_EXTRACTION], content=first_text)
    candidates = detect([FX_EXTRACTION], content=second_text)

    for candidate in candidates:
        for evidence in candidate["source_evidence"]:
            assert evidence["quote"] == second_text


def test_registration_without_any_date_requires_clarification() -> None:
    undated = {**FX_EXTRACTION, "effective_date": None}
    candidate = detect([undated])[0]
    response = register_detected(candidate["shock_id"])
    assert response.status_code == 422
    assert response.json()["error"]["required_fields"] == ["published_at"]


def test_registration_uses_supplied_publication_date_when_source_states_none() -> None:
    undated = {**FX_EXTRACTION, "effective_date": None}
    candidate = detect([undated], published_at="2026-09-30")[0]
    shock = register_detected(candidate["shock_id"]).json()
    assert shock["observed_or_effective_date"] == "2026-09-30"
    assert "publication date" in shock["source_notes"]


# ---------------------------------------------------------------------------
# TRACE -> QUANTIFY prerequisite and shock-type gating
# ---------------------------------------------------------------------------


def test_quantify_requires_an_existing_trace_mapping() -> None:
    shock = make_verified_shock()
    business_id = uuid4()
    profile_id = confirm_profile(business_id)

    response = quantify(shock["id"], str(uuid4()), profile_id)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "CLARIFICATION_REQUIRED"
    assert error["required_fields"] == ["impact_mapping_id"]


def test_quantify_rejects_a_mapping_for_another_shock() -> None:
    shock = make_verified_shock()
    other = make_pending_shock()
    business_id = uuid4()
    profile_id = confirm_profile(business_id)
    other_mapping = make_mapping(other["id"], business_id)

    response = quantify(shock["id"], other_mapping, profile_id)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "STATE_CONFLICT"


def test_quantify_rejects_a_mapping_for_another_business() -> None:
    shock = make_verified_shock()
    mapped_business = uuid4()
    confirm_profile(mapped_business)
    mapping_id = make_mapping(shock["id"], mapped_business)
    other_profile = confirm_profile(uuid4())

    response = quantify(shock["id"], mapping_id, other_profile)
    assert response.status_code == 409


def test_quantify_blocks_unsupported_shock_type() -> None:
    inflation_text = "PBS reported that inflation increased to 11.1 percent in September."
    inflation = {
        **FX_EXTRACTION,
        "shock_type": "inflation",
        "variable": "inflation",
        "magnitude": 11.1,
    }
    shock = make_verified_shock(inflation, content=inflation_text)
    business_id = uuid4()
    profile_id = confirm_profile(business_id)
    mapping_id = make_mapping(shock["id"], business_id)

    response = quantify(shock["id"], mapping_id, profile_id)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "UNSUPPORTED_SHOCK_TYPE"
    assert error["stage"] == "QUANTIFY"


def test_quantify_uses_shock_magnitude_without_business_exchange_rate_change() -> None:
    shock = make_verified_shock()
    business_id = uuid4()
    profile_id = confirm_profile(business_id, BUSINESS_FACTS)
    mapping_id = make_mapping(shock["id"], business_id)

    response = quantify(shock["id"], mapping_id, profile_id)
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    # 400 units x 50 x 280 = 5,600,000; +5% exchange rate = 5,880,000.
    assert result["baseline_imported_cost"] == 5600000
    assert result["shocked_imported_cost"] == 5880000


def test_quantify_lists_missing_business_facts() -> None:
    shock = make_verified_shock()
    business_id = uuid4()
    profile_id = confirm_profile(business_id, {"sales_quantity": {"value": "10", "unit": "units"}})
    mapping_id = make_mapping(shock["id"], business_id)

    response = quantify(shock["id"], mapping_id, profile_id)
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "CLARIFICATION_REQUIRED"
    assert "selling_price_per_unit" in error["required_fields"]
    assert "exchange_rate_change" not in error["required_fields"]


# ---------------------------------------------------------------------------
# SIMULATE and COMPARE
# ---------------------------------------------------------------------------


def baseline_result(business_id) -> str:
    shock = make_verified_shock()
    profile_id = confirm_profile(business_id)
    mapping_id = make_mapping(shock["id"], business_id)
    response = quantify(shock["id"], mapping_id, profile_id)
    assert response.status_code == 200, response.text
    return response.json()["id"]


def run_scenario(business_id, impact_result_id: str, assumptions: list[dict]):
    created = client.post(
        "/api/v1/scenarios",
        json={
            "business_id": str(business_id),
            "base_impact_result_id": impact_result_id,
            "name": "Owner scenario",
            "changed_assumptions": assumptions,
        },
    )
    assert created.status_code == 201, created.text
    scenario_id = created.json()["id"]
    assert client.post(f"/api/v1/scenarios/{scenario_id}/confirm").status_code == 200
    return client.post(f"/api/v1/scenarios/{scenario_id}/run")


def test_unsupported_scenario_assumption_is_blocked_not_ignored() -> None:
    business_id = uuid4()
    impact_result_id = baseline_result(business_id)

    response = run_scenario(
        business_id,
        impact_result_id,
        [{"field_reference": "price_change", "value": "4", "unit": "percent"}],
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "CLARIFICATION_REQUIRED"
    assert error["stage"] == "SIMULATE"


def test_edited_scenario_runs_with_the_new_assumptions() -> None:
    business_id = uuid4()
    impact_result_id = baseline_result(business_id)
    created = client.post(
        "/api/v1/scenarios",
        json={
            "business_id": str(business_id),
            "base_impact_result_id": impact_result_id,
            "name": "Owner scenario",
            "changed_assumptions": [{"field_reference": "selling_price_per_unit", "value": "208"}],
        },
    ).json()
    edited = client.patch(
        f"/api/v1/scenarios/{created['id']}",
        json={"changed_assumptions": [{"field_reference": "selling_price_per_unit", "value": "220"}]},
    )
    assert edited.status_code == 200
    assert edited.json()["assumption_confirmation_status"] == "draft"
    assert client.post(f"/api/v1/scenarios/{created['id']}/confirm").status_code == 200

    run = client.post(f"/api/v1/scenarios/{created['id']}/run")
    assert run.status_code == 200, run.text
    # 1000 units x 220 = 220,000 projected revenue.
    assert run.json()["result"]["projected"]["shocked_revenue"] == 220000


def test_invalid_scenario_value_is_a_structured_error() -> None:
    business_id = uuid4()
    impact_result_id = baseline_result(business_id)

    response = run_scenario(
        business_id,
        impact_result_id,
        [{"field_reference": "imported_quantity", "value": "-5"}],
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_INPUT"


def test_comparison_is_returned_stored_and_does_not_rank() -> None:
    business_id = uuid4()
    impact_result_id = baseline_result(business_id)
    price = run_scenario(
        business_id,
        impact_result_id,
        [{"field_reference": "selling_price_per_unit", "value": "208"}],
    ).json()
    imports = run_scenario(
        business_id,
        impact_result_id,
        [{"field_reference": "imported_quantity", "value": "340"}],
    ).json()

    response = client.post(
        "/api/v1/comparisons",
        json={
            "business_id": str(business_id),
            "base_impact_result_id": impact_result_id,
            "scenario_result_ids": [price["id"], imports["id"]],
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["id"]
    assert [row["name"] for row in body["comparisons"]] == ["Owner scenario", "Owner scenario"]
    assert "projected_profit_increases" in body["comparisons"][0]["trade_offs"]
    assert all("winner" not in row and "recommendation" not in row for row in body["comparisons"])

    stored = client.get(f"/api/v1/comparisons/{body['id']}")
    assert stored.status_code == 200
    assert stored.json()["id"] == body["id"]


def test_comparison_rejects_scenario_from_another_base_result() -> None:
    business_id = uuid4()
    first = baseline_result(business_id)
    second = baseline_result(business_id)
    scenario = run_scenario(
        business_id,
        second,
        [{"field_reference": "selling_price_per_unit", "value": "208"}],
    ).json()

    response = client.post(
        "/api/v1/comparisons",
        json={
            "business_id": str(business_id),
            "base_impact_result_id": first,
            "scenario_result_ids": [scenario["id"]],
        },
    )
    assert response.status_code == 409
