from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.core.errors import ContractError, contract_error_handler, validation_error_handler
from app.services.orchestrator import WorkflowOrchestrator
from app.services.groq import GroqService, LLMMessage
from app.services.store import InMemoryStore
from app.services.economic_intelligence import (
    EconomicEvidenceVerifier,
    EconomicIntelligenceService,
    EconomicMonitor,
    EconomicShockExtractor,
    LocalEconomicRetriever,
)


class GroqExtractorAdapter:
    """Adapts TADBIR's provider-neutral GroqService to Member 2's LLM boundary."""

    def __init__(self, groq_service: GroqService) -> None:
        self.groq_service = groq_service

    def complete(self, messages: list[dict[str, str]]) -> str:
        llm_messages = [
            LLMMessage(role=message["role"], content=message["content"])
            for message in messages
        ]
        return self.groq_service.complete(llm_messages)


app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(ContractError, contract_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)

store = InMemoryStore()
orchestrator = WorkflowOrchestrator(store)
groq_service = GroqService(settings)

economic_retriever = LocalEconomicRetriever()
economic_verifier = EconomicEvidenceVerifier()
economic_extractor = EconomicShockExtractor(
    GroqExtractorAdapter(groq_service)
)
economic_monitor = EconomicMonitor(
    retriever=economic_retriever,
    extractor=economic_extractor,
    verifier=economic_verifier,
)
economic_intelligence = EconomicIntelligenceService(economic_monitor)

app.include_router(router, prefix=settings.api_prefix)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
