import { createSupabaseRepositoryContext } from "../src/infrastructure/db";
import { loadEnvFiles } from "./load-env";

async function main() {
  loadEnvFiles();
  const repositories = createSupabaseRepositoryContext();

  const [masters, aiNumbers, leads, calls] = await Promise.all([
    repositories.masters.list(),
    repositories.aiNumbers.list(),
    repositories.leads.list(),
    repositories.calls.list(),
  ]);

  const demoMaster = masters.find((master) => master.phone === "+77001234567");
  if (!demoMaster) {
    throw new Error("Demo master was not found.");
  }

  const demoSubscription = await repositories.subscriptions.getByMaster(demoMaster.id);
  if (!demoSubscription) {
    throw new Error("Demo subscription was not found.");
  }

  const demoCall = calls.find((call) => call.provider === "demo" && call.providerCallId === "demo-call-1");
  if (!demoCall) {
    throw new Error("Demo call was not found.");
  }

  const demoLead = leads.find((lead) => lead.callId === demoCall.id);
  if (!demoLead) {
    throw new Error("Demo lead was not found.");
  }

  const demoNumbers = aiNumbers.filter((number) =>
    ["+77273330001", "+77273330002"].includes(number.phoneNumber),
  );
  if (demoNumbers.length !== 2) {
    throw new Error("Expected two demo AI numbers.");
  }

  console.log("Admin data smoke verification passed.");
  console.log(`Verified counts: masters=${masters.length}, ai_numbers=${aiNumbers.length}, leads=${leads.length}, calls=${calls.length}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown smoke verification error";
  console.error(`Admin data smoke verification failed: ${message}`);
  process.exitCode = 1;
});
