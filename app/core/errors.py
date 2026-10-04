from collections.abc import Sequence

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ContractError(Exception):
    """A contract-defined API error that never fabricates a result."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        stage: str | None = None,
        required_fields: Sequence[str] = (),
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.stage = stage
        self.required_fields = list(required_fields)


def error_body(error: ContractError) -> dict[str, object]:
    payload: dict[str, object] = {
        "code": error.code,
        "message": error.message,
    }
    if error.stage is not None:
        payload["stage"] = error.stage
    if error.required_fields:
        payload["required_fields"] = error.required_fields
    return {"error": payload}


async def contract_error_handler(_: Request, exc: ContractError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=error_body(exc))


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [".".join(str(part) for part in error["loc"][1:]) for error in exc.errors()]
    error = ContractError(
        400,
        "INVALID_REQUEST",
        "Request validation failed.",
        required_fields=fields,
    )
    return JSONResponse(status_code=400, content=error_body(error))
