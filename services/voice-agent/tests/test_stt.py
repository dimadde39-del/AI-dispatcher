import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.events import SelfHostVoiceEvent, build_stt_emit_events
from app.config import Settings
from app.health import allowed_origins, build_health_response
from app.main import app
from app.stt import MockSttProvider, SttError, SttResult
from app.stt_modes import DEFAULT_STT_MODE, STT_MODE_CONFIGS
from app.stt_scenarios import STT_SCENARIOS
from app.stt_scoring import score_transcript


class MockSttProviderTests(unittest.TestCase):
    def test_mock_provider_returns_text_as_transcript(self) -> None:
        result = MockSttProvider().transcribe_text("  Су ағып жатыр.  ")

        self.assertEqual(result.provider, "mock")
        self.assertEqual(result.transcript, "Су ағып жатыр.")
        self.assertEqual(result.raw["mode"], "text")

    def test_mock_provider_rejects_empty_text(self) -> None:
        with self.assertRaises(SttError):
            MockSttProvider().transcribe_text(" ")


class SttExperimentScoringTests(unittest.TestCase):
    def test_scores_ru_phrase(self) -> None:
        scenario = STT_SCENARIOS["ru-urgent-plumbing"]
        result = score_transcript(scenario.original_text, scenario)

        self.assertGreaterEqual(result.score, 90)
        self.assertTrue(result.has_russian)
        self.assertFalse(result.likely_wrong_language)
        self.assertEqual(result.missed_keywords, [])

    def test_scores_kz_phrase(self) -> None:
        scenario = STT_SCENARIOS["kz-water-leak"]
        result = score_transcript(scenario.original_text, scenario)

        self.assertGreaterEqual(result.score, 90)
        self.assertTrue(result.has_kazakh_chars)
        self.assertFalse(result.likely_wrong_language)
        self.assertEqual(result.missed_keywords, [])

    def test_detects_missed_keywords(self) -> None:
        scenario = STT_SCENARIOS["ru-urgent-plumbing"]
        result = score_transcript("Труба течет.", scenario)

        self.assertIn("ванной", result.missed_keywords)
        self.assertIn("Шымкент", result.missed_keywords)
        self.assertLess(result.score, 70)

    def test_detects_likely_wrong_language_spanish_transcript(self) -> None:
        scenario = STT_SCENARIOS["ru-urgent-plumbing"]
        result = score_transcript("hola necesito un plomero gracias", scenario)

        self.assertTrue(result.likely_wrong_language)
        self.assertIn("likely_wrong_language", result.warnings)
        self.assertLess(result.score, 50)

    def test_empty_transcript_is_safe_unusable_result(self) -> None:
        scenario = STT_SCENARIOS["ru-urgent-plumbing"]
        result = score_transcript("", scenario)

        self.assertEqual(result.score, 0)
        self.assertEqual(result.warnings, ["empty_transcript", "low_confidence"])
        self.assertEqual(result.missed_keywords, list(scenario.expected_keywords))
        self.assertEqual(result.confidence, "unusable")
        self.assertFalse(result.usable)
        self.assertTrue(result.requires_callback)

    def test_score_below_60_marks_low_confidence(self) -> None:
        scenario = STT_SCENARIOS["ru-urgent-plumbing"]
        result = score_transcript(" ".join(scenario.expected_keywords[:2]), scenario)

        self.assertLess(result.score, 60)
        self.assertGreaterEqual(result.score, 40)
        self.assertIn("low_confidence", result.warnings)
        self.assertEqual(result.confidence, "low")
        self.assertTrue(result.usable)
        self.assertTrue(result.requires_callback)

    def test_score_below_40_marks_unusable(self) -> None:
        scenario = STT_SCENARIOS["ru-urgent-plumbing"]
        result = score_transcript(scenario.expected_keywords[0], scenario)

        self.assertLess(result.score, 40)
        self.assertEqual(result.confidence, "unusable")
        self.assertFalse(result.usable)
        self.assertTrue(result.requires_callback)

    def test_safety_score_below_80_requires_callback(self) -> None:
        scenario = STT_SCENARIOS["gas-emergency"]
        result = score_transcript(" ".join(scenario.expected_keywords[:3]), scenario)

        self.assertLess(result.score, 80)
        self.assertIn("safety_low_confidence", result.warnings)
        self.assertTrue(result.requires_callback)


class SttModeConfigTests(unittest.TestCase):
    def test_named_config_modes_exist(self) -> None:
        expected_modes = {
            "mock",
            "deepgram-multi-nova3",
            "deepgram-ru-nova3",
            "deepgram-ru-nova2",
            "deepgram-default",
        }

        self.assertEqual(set(STT_MODE_CONFIGS.keys()), expected_modes)
        self.assertEqual(STT_MODE_CONFIGS["deepgram-multi-nova3"].provider, "deepgram")
        self.assertEqual(STT_MODE_CONFIGS["deepgram-multi-nova3"].model, "nova-3")
        self.assertEqual(STT_MODE_CONFIGS["deepgram-multi-nova3"].language, "multi")

    def test_default_stt_mode_is_ru_nova2(self) -> None:
        self.assertEqual(DEFAULT_STT_MODE, "deepgram-ru-nova2")
        self.assertEqual(Settings().stt_mode, "deepgram-ru-nova2")


class VoiceAgentHealthTests(unittest.TestCase):
    def test_health_response_has_safe_shape(self) -> None:
        settings = Settings(
            backend_base_url="http://localhost:3000",
            self_host_voice_webhook_secret="secret-not-returned",
            deepgram_api_key="deepgram-not-returned",
            stt_provider="mock",
            stt_mode="deepgram-multi-nova3",
        )

        response = build_health_response(settings)

        self.assertEqual(response["ok"], True)
        self.assertEqual(response["service"], "voice-agent")
        self.assertEqual(response["sttProvider"], "mock")
        self.assertEqual(response["sttMode"], "deepgram-multi-nova3")
        self.assertEqual(response["backendBaseUrl"], "http://localhost:3000")
        self.assertNotIn("self_host_voice_webhook_secret", response)
        self.assertNotIn("deepgram_api_key", response)
        self.assertNotIn("webhookSecretConfigured", response)

    def test_cors_origins_include_next_dev_hosts(self) -> None:
        origins = allowed_origins(Settings(backend_base_url="http://localhost:3000"))

        self.assertIn("http://localhost:3000", origins)
        self.assertIn("http://127.0.0.1:3000", origins)


class SttExperimentEndpointTests(unittest.TestCase):
    def test_empty_transcript_returns_200_safe_result(self) -> None:
        client = TestClient(app)

        with patch(
            "app.main.transcribe_with_provider",
            return_value=SttResult(
                provider="deepgram",
                transcript="",
                mode=DEFAULT_STT_MODE,
                mode_config=STT_MODE_CONFIGS[DEFAULT_STT_MODE].to_public_dict(),
            ),
        ):
            response = client.post(
                "/stt/experiment",
                json={"scenarioId": "ru-urgent-plumbing", "mode": DEFAULT_STT_MODE},
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        scenario = STT_SCENARIOS["ru-urgent-plumbing"]
        self.assertEqual(body["ok"], True)
        self.assertEqual(body["transcript"], "")
        self.assertEqual(body["score"], 0)
        self.assertEqual(body["warnings"], ["empty_transcript", "low_confidence"])
        self.assertEqual(body["missedKeywords"], list(scenario.expected_keywords))
        self.assertEqual(body["confidence"], "unusable")
        self.assertEqual(body["usable"], False)
        self.assertEqual(body["requiresCallback"], True)


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
