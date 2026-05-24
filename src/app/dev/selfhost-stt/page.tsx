import type { Metadata } from "next";
import { SelfHostSttClient } from "./SelfHostSttClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Self-Host STT Dev | AI Dispatcher",
  description: "Internal upload-based microphone test page for self-host STT events.",
};

export default function SelfHostSttDevPage() {
  const productionDisabled =
    process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_SELFHOST_STT !== "true";
  const voiceAgentUrl = productionDisabled
    ? ""
    : (process.env.NEXT_PUBLIC_SELF_HOST_VOICE_AGENT_URL?.trim() || "http://localhost:8001");

  return <SelfHostSttClient enabled={!productionDisabled} voiceAgentUrl={voiceAgentUrl} />;
}
