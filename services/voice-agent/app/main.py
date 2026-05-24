from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import UploadFile

from .backend_client import BackendClient, BackendClientError
from .config import load_settings
from .events import build_stt_emit_events
from .health import allowed_origins, build_health_response
from .stt import SttError, SttResult, transcribe_with_provider
from .stt_modes import list_stt_mode_configs
from .stt_scenarios import get_stt_scenario, list_stt_scenarios
from .stt_scoring import score_transcript

app = FastAPI(title="AI Dispatcher Self-Host Voice Agent Spike")


def _allowed_origins() -> list[str]:
    return allowed_origins(load_settings())


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["accept", "content-type"],
)


@app.get("/health")
def health() -> dict[str, object]:
    return build_health_response(load_settings())


@app.get("/stt/modes")
def stt_modes() -> dict[str, object]:
    return {
        "modes": [mode.to_public_dict() for mode in list_stt_mode_configs()],
    }


@app.get("/stt/scenarios")
def stt_scenarios() -> dict[str, object]:
    return {
        "scenarios": [scenario.to_public_dict() for scenario in list_stt_scenarios()],
    }


async def _request_input(request: Request) -> dict[str, Any]:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("application/json"):
        body = await request.json()
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="JSON body must be an object.")
        return {
            "text": body.get("text"),
            "provider": body.get("provider"),
            "mode": body.get("mode"),
            "scenario_id": body.get("scenarioId") or body.get("scenario_id"),
            "provider_call_id": body.get("providerCallId"),
            "ai_number": body.get("aiNumber"),
            "customer_phone": body.get("customerPhone"),
            "audio": None,
            "content_type": None,
        }

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("file")
        audio: bytes | None = None
        upload_content_type: str | None = None
        if isinstance(upload, UploadFile):
            audio = await upload.read()
            upload_content_type = upload.content_type

        return {
            "text": _form_text(form.get("text")),
            "provider": _form_text(form.get("provider")),
            "mode": _form_text(form.get("mode")),
            "scenario_id": _form_text(form.get("scenarioId")) or _form_text(form.get("scenario_id")),
            "provider_call_id": _form_text(form.get("providerCallId")),
            "ai_number": _form_text(form.get("aiNumber")),
            "customer_phone": _form_text(form.get("customerPhone")),
            "audio": audio,
            "content_type": upload_content_type,
        }

    raise HTTPException(status_code=415, detail="Use application/json or multipart/form-data.")


def _form_text(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _safe_response(result: SttResult) -> dict[str, object]:
    response: dict[str, object] = {
        "ok": True,
        "provider": result.provider,
        "mode": result.mode,
        "transcript": result.transcript,
    }

    if result.mode_config:
        response["modeConfig"] = result.mode_config

    if result.raw:
        response["raw"] = result.raw

    return response


def _transcribe(input_data: dict[str, Any]) -> SttResult:
    try:
        return transcribe_with_provider(
            load_settings(),
            provider_name=_text_or_none(input_data.get("provider")),
            mode_name=_text_or_none(input_data.get("mode")),
            text=_text_or_none(input_data.get("text")),
            audio=input_data.get("audio"),
            content_type=_text_or_none(input_data.get("content_type")),
        )
    except SttError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _text_or_none(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _timestamp_call_id() -> str:
    return f"selfhost-web-{int(datetime.now(timezone.utc).timestamp() * 1000)}"


def _summary_from_transcript(transcript: str) -> str:
    compact = " ".join(transcript.split())
    if len(compact) <= 500:
        return compact
    return f"{compact[:499].rstrip()}..."


@app.post("/stt/transcribe")
async def transcribe(request: Request) -> dict[str, object]:
    input_data = await _request_input(request)
    return _safe_response(_transcribe(input_data))


@app.post("/stt/experiment")
async def stt_experiment(request: Request) -> dict[str, object]:
    input_data = await _request_input(request)
    scenario_id = _text_or_none(input_data.get("scenario_id"))
    if not scenario_id:
        raise HTTPException(status_code=400, detail="scenarioId is required.")

    try:
        scenario = get_stt_scenario(scenario_id)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Unknown STT scenario: {scenario_id}") from exc

    result = _transcribe(input_data)
    scored = score_transcript(result.transcript, scenario)
    score_payload = scored.to_public_dict()

    return {
        "ok": True,
        "mode": result.mode,
        "modeConfig": result.mode_config,
        "scenario": scenario.to_public_dict(),
        "transcript": result.transcript,
        **score_payload,
    }


@app.post("/stt/transcribe-and-emit")
async def transcribe_and_emit(request: Request) -> dict[str, object]:
    input_data = await _request_input(request)
    result = _transcribe(input_data)
    settings = load_settings()
    backend_client = BackendClient(settings)
    provider_call_id = _text_or_none(input_data.get("provider_call_id")) or _timestamp_call_id()
    ai_number = _text_or_none(input_data.get("ai_number")) or "web-dev"
    customer_phone = _text_or_none(input_data.get("customer_phone"))
    events = build_stt_emit_events(
        provider_call_id=provider_call_id,
        transcript=result.transcript,
        summary=_summary_from_transcript(result.transcript),
        ai_number=ai_number,
        customer_phone=customer_phone,
    )

    emitted: list[dict[str, object]] = []
    try:
        for event in events:
            emitted.append(backend_client.send_event(event))
    except BackendClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "ok": True,
        "provider": result.provider,
        "mode": result.mode,
        "modeConfig": result.mode_config,
        "providerCallId": provider_call_id,
        "transcript": result.transcript,
        "emittedEvents": len(emitted),
        "backendResults": emitted,
    }
