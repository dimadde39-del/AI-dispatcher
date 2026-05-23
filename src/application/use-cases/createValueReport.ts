import { z } from "zod";
import type { RepositoryContext } from "@/application/ports";
import { calculateValueReportMetrics, type ValueReport } from "@/domain";

export const CreateValueReportCommandSchema = z.object({
  masterId: z.string().uuid(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

export type CreateValueReportCommand = z.infer<typeof CreateValueReportCommandSchema>;

function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59.999Z`).toISOString();
}

export async function createValueReport(
  repositories: RepositoryContext,
  command: CreateValueReportCommand,
): Promise<ValueReport> {
  const input = CreateValueReportCommandSchema.parse(command);
  const master = await repositories.masters.getById(input.masterId);
  if (!master) {
    throw new Error(`Master ${input.masterId} was not found.`);
  }

  const calls = await repositories.calls.listByMasterAndPeriod(
    master.id,
    startOfDayIso(input.periodStart),
    endOfDayIso(input.periodEnd),
  );
  const leads = await repositories.leads.listByMasterAndPeriod(
    master.id,
    startOfDayIso(input.periodStart),
    endOfDayIso(input.periodEnd),
  );
  const metrics = calculateValueReportMetrics({
    tradeType: master.tradeType,
    calls,
    leads,
  });

  const report = await repositories.valueReports.create({
    masterId: master.id,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalCalls: metrics.totalCalls,
    capturedLeads: metrics.capturedLeads,
    acceptedLeads: metrics.acceptedLeads,
    estimatedSavedRevenueMin: metrics.estimatedSavedRevenueMin,
    estimatedSavedRevenueMax: metrics.estimatedSavedRevenueMax,
    sentAt: null,
  });

  await repositories.auditLogs.create({
    actorType: "system",
    eventType: "VALUE_REPORT_CREATED",
    entityType: "value_report",
    entityId: report.id,
    payload: {
      masterId: master.id,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      acceptedLeads: report.acceptedLeads,
    },
  });

  return report;
}
