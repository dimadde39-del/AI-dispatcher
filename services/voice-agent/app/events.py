from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Literal


SelfHostEventType = Literal["call_started", "transcript_updated", "call_ended"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class SelfHostVoiceEvent:
    type: SelfHostEventType
    provider_call_id: str
    customer_phone: str | None = None
    ai_number: str | None = "web-dev"
    started_at: str | None = None
    ended_at: str | None = None
    duration_seconds: int | None = None
    transcript: str | None = None
    summary: str | None = None
    recording_url: str | None = None
    timestamp: str | None = None

    def to_backend_payload(self) -> dict[str, object | None]:
        data = asdict(self)
        payload: dict[str, object | None] = {
            "provider": "self-host",
            "type": data.pop("type"),
            "providerCallId": data.pop("provider_call_id"),
        }

        field_map = {
            "customer_phone": "customerPhone",
            "ai_number": "aiNumber",
            "started_at": "startedAt",
            "ended_at": "endedAt",
            "duration_seconds": "durationSeconds",
            "recording_url": "recordingUrl",
        }

        for key, value in data.items():
            payload[field_map.get(key, key)] = value

        return payload


def build_stt_emit_events(
    provider_call_id: str,
    transcript: str,
    summary: str,
    ai_number: str = "web-dev",
    customer_phone: str | None = None,
) -> list[SelfHostVoiceEvent]:
    started_at = utc_now_iso()
    ended_at = utc_now_iso()
    return [
        SelfHostVoiceEvent(
            type="call_started",
            provider_call_id=provider_call_id,
            customer_phone=customer_phone,
            ai_number=ai_number,
            started_at=started_at,
        ),
        SelfHostVoiceEvent(
            type="transcript_updated",
            provider_call_id=provider_call_id,
            transcript=transcript,
            timestamp=ended_at,
        ),
        SelfHostVoiceEvent(
            type="call_ended",
            provider_call_id=provider_call_id,
            customer_phone=customer_phone,
            ai_number=ai_number,
            started_at=started_at,
            ended_at=ended_at,
            duration_seconds=None,
            transcript=transcript,
            summary=summary,
            recording_url=None,
        ),
    ]
