import { createSupabaseRepositoryContext } from "../src/infrastructure/db";
import { loadEnvFiles } from "./load-env";

function limitFromArgs(): number {
  const prefix = "--limit=";
  const rawValue = process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  const parsed = rawValue ? Number(rawValue) : 10;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 50) : 10;
}

async function main() {
  loadEnvFiles();

  const limit = limitFromArgs();
  const repositories = createSupabaseRepositoryContext();
  const [calls, leads] = await Promise.all([repositories.calls.list(), repositories.leads.list()]);
  const recentVapiCalls = calls
    .filter((call) => call.provider === "vapi")
    .slice(0, limit)
    .map((call) => ({
      providerCallId: call.providerCallId,
      status: call.status,
      createdAt: call.createdAt,
      hasTranscript: Boolean(call.transcript),
      linkedLeadCount: leads.filter((lead) => lead.callId === call.id).length,
    }));

  console.log(JSON.stringify(recentVapiCalls, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown Vapi recent calls error";
  console.error(`Vapi recent calls failed: ${message}`);
  process.exitCode = 1;
});
