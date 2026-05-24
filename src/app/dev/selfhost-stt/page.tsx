import type { Metadata } from "next";
import { SelfHostSttClient } from "./SelfHostSttClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Self-Host STT Experiment | AI Dispatcher",
  description: "Internal RU/KZ STT mode experiment page for the self-host voice spike.",
};

export default function SelfHostSttDevPage() {
  const productionDisabled =
    process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_SELFHOST_STT !== "true";
  const voiceAgentUrl = productionDisabled
    ? ""
    : (process.env.NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL?.trim() || "http://localhost:8001");

  return <SelfHostSttClient enabled={!productionDisabled} voiceAgentUrl={voiceAgentUrl} />;
}
