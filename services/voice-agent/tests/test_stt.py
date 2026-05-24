import unittest

from app.events import SelfHostVoiceEvent, build_stt_emit_events
from app.stt import MockSttProvider, SttError


class MockSttProviderTests(unittest.TestCase):
    def test_mock_provider_returns_text_as_transcript(self) -> None:
        result = MockSttProvider().transcribe_text("  Су ағып жатыр.  ")

        self.assertEqual(result.provider, "mock")
        self.assertEqual(result.transcript, "Су ағып жатыр.")
        self.assertEqual(result.raw["mode"], "text")

    def test_mock_provider_rejects_empty_text(self) -> None:
        with self.assertRaises(SttError):
            MockSttProvider().transcribe_text(" ")


class SelfHostVoiceEventPayloadTests(unittest.TestCase):
    def test_backend_payload_uses_internal_self_host_shape(self) -> None:
        event = SelfHostVoiceEvent(
            type="call_ended",
            provider_call_id="selfhost-web-test",
            customer_phone=None,
            ai_number="web-dev",
            started_at="2026-05-24T10:00:00Z",
            ended_at="2026-05-24T10:00:05Z",
            duration_seconds=5,
            transcript="Здравствуйте",
            summary="Здравствуйте",
            recording_url=None,
        )

        self.assertEqual(
            event.to_backend_payload(),
            {
                "provider": "self-host",
                "type": "call_ended",
                "providerCallId": "selfhost-web-test",
                "customerPhone": None,
                "aiNumber": "web-dev",
                "startedAt": "2026-05-24T10:00:00Z",
                "endedAt": "2026-05-24T10:00:05Z",
                "durationSeconds": 5,
                "transcript": "Здравствуйте",
                "summary": "Здравствуйте",
                "recordingUrl": None,
                "timestamp": None,
            },
        )

    def test_stt_emit_events_use_expected_sequence(self) -> None:
        events = build_stt_emit_events(
            provider_call_id="selfhost-web-test",
            transcript="Здравствуйте",
            summary="Здравствуйте",
        )

        self.assertEqual([event.type for event in events], ["call_started", "transcript_updated", "call_ended"])
        self.assertEqual([event.provider_call_id for event in events], ["selfhost-web-test"] * 3)
        self.assertEqual(events[1].transcript, "Здравствуйте")
        self.assertEqual(events[2].summary, "Здравствуйте")


if __name__ == "__main__":
    unittest.main()
