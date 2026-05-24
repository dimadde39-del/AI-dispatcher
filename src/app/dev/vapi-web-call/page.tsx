import type { Metadata } from "next";
import { VapiWebCallClient } from "./VapiWebCallClient";

const ASSISTANT_ID = "cc79d655-ed1f-47fb-ab03-a55558e8f48a";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vapi Web Call Dev | AI Dispatcher",
  description: "Internal browser microphone test page for Vapi Web Calls.",
};

export default function VapiWebCallDevPage() {
  const productionDisabled =
    process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_VAPI_WEB_CALL !== "true";
  const publicKey = productionDisabled ? "" : (process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY?.trim() ?? "");

  return (
    <VapiWebCallClient
      assistantId={ASSISTANT_ID}
      enabled={!productionDisabled}
      publicKey={publicKey}
    />
  );
}
