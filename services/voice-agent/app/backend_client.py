import json
from urllib import error, request

from .config import Settings
from .events import SelfHostVoiceEvent


class BackendClientError(RuntimeError):
    pass


class BackendClient:
    def __init__(self, settings: Settings):
        self._settings = settings

    @property
    def webhook_url(self) -> str:
        return f"{self._settings.backend_base_url}/api/webhooks/self-host-voice"

    def send_event(self, event: SelfHostVoiceEvent) -> dict[str, object]:
        body = json.dumps(event.to_backend_payload()).encode("utf-8")
        headers = {
            "content-type": "application/json",
        }

        if self._settings.self_host_voice_webhook_secret:
            headers["x-self-host-voice-secret"] = self._settings.self_host_voice_webhook_secret

        http_request = request.Request(self.webhook_url, data=body, headers=headers, method="POST")
        try:
            with request.urlopen(http_request, timeout=10) as response:
                response_body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            safe_body = exc.read().decode("utf-8", errors="replace")[:300]
            raise BackendClientError(f"Backend webhook failed with HTTP {exc.code}: {safe_body}") from exc
        except error.URLError as exc:
            raise BackendClientError(f"Backend webhook request failed: {exc.reason}") from exc

        parsed = json.loads(response_body)
        if not isinstance(parsed, dict):
            raise BackendClientError("Backend returned a non-object response.")

        return parsed
