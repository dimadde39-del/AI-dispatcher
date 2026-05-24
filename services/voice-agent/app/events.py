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
