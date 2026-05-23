import { createSupabaseRepositoryContext } from "../src/infrastructure/db";
import { findDemoLead } from "./telegram-demo-data";
import { loadEnvFiles } from "./load-env";

async function main() {
  loadEnvFiles();

  const repositories = createSupabaseRepositoryContext();
  const demoLead = findDemoLead(await repositories.leads.list());

  if (!demoLead) {
    throw new Error("No demo lead found. Run npm run seed first.");
  }

  console.log(
    JSON.stringify(
      {
        leadId: demoLead.id,
        status: demoLead.status,
        acceptedAt: demoLead.acceptedAt,
        updatedAt: demoLead.updatedAt,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown lead status error";
  console.error(`Lead status failed: ${message}`);
  process.exitCode = 1;
});
