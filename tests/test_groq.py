from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app
from app.services.groq import GroqConfigurationError, GroqService, LLMMessage


def test_groq_configuration_reads_environment_without_exposing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-secret-key")
    monkeypatch.setenv("GROQ_MODEL", "test-model")
    settings = Settings.from_environment()

    assert settings.groq_api_key == "test-secret-key"
    assert settings.groq_model == "test-model"
    assert "test-secret-key" not in repr(settings)


def test_missing_groq_key_fails_only_when_operation_is_invoked() -> None:
    service = GroqService(Settings(groq_model="test-model"))
    assert service.is_configured is False

    with pytest.raises(GroqConfigurationError, match="GROQ_API_KEY is not configured"):
        service.complete([LLMMessage(role="user", content="test")])


def test_groq_service_is_testable_without_network() -> None:
    calls: list[tuple[str, list[dict[str, str]]]] = []

    class FakeCompletions:
        def create(self, *, model: str, messages: list[dict[str, str]]) -> object:
            calls.append((model, messages))
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="test response"))])

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    service = GroqService(Settings(groq_api_key="test-secret-key", groq_model="test-model"), lambda _: fake_client)

    assert service.complete([LLMMessage(role="user", content="test")]) == "test response"
    assert calls == [("test-model", [{"role": "user", "content": "test"}])]


def test_api_response_never_exposes_environment_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GROQ_API_KEY", "test-secret-key")
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert "test-secret-key" not in response.text
