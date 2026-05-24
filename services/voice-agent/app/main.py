from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import UploadFile

from .backend_client import BackendClient, BackendClientError
from .config import load_settings
from .events import build_stt_emit_events
from .stt import SttError, SttResult, transcribe_with_provider

app = FastAPI(title="AI Dispatcher Self-Host Voice Agent Spike")


def _allowed_origins() -> list[str]:
    settings = load_settings()
    origins = {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        settings.backend_base_url,
    }
    return sorted(origin for origin in origins if origin)


app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["content-type"],
)


@app.get("/health")
def health() -> dict[str, object]:
    settings = load_settings()
    return {
        "ok": True,
        "service": "voice-agent",
        "backendBaseUrlConfigured": bool(settings.backend_base_url),
        "webhookSecretConfigured": bool(settings.self_host_voice_webhook_secret),
        "sttProvider": settings.stt_provider,
        "sttLanguageMode": settings.stt_language_mode,
        "deepgramConfigured": bool(settings.deepgram_api_key),
        "productionReady": False,
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
        "transcript": result.transcript,
    }

    if result.raw:
        response["raw"] = result.raw

    return response


def _transcribe(input_data: dict[str, Any]) -> SttResult:
    try:
        return transcribe_with_provider(
            load_settings(),
            provider_name=_text_or_none(input_data.get("provider")),
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
        "providerCallId": provider_call_id,
        "transcript": result.transcript,
        "emittedEvents": len(emitted),
        "backendResults": emitted,
    }
