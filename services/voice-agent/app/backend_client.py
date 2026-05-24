import json
from urllib import request

from .config import Settings
from .events import SelfHostVoiceEvent


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
        with request.urlopen(http_request, timeout=10) as response:
            response_body = response.read().decode("utf-8")

        parsed = json.loads(response_body)
        if not isinstance(parsed, dict):
            raise ValueError("Backend returned a non-object response.")

        return parsed
