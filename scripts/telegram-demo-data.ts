import type { Lead } from "../src/domain";

export const DEMO_CUSTOMER_PHONE = "+77007654321";

export interface DemoTimestampRefresh {
  callStartedAt: string;
  callCreatedAt: string;
  leadCreatedAt: string;
  leadUpdatedAt: string;
}

export function findDemoLead(leads: Lead[]): Lead | null {
  return leads.find((lead) => lead.customerPhone === DEMO_CUSTOMER_PHONE) ?? leads[0] ?? null;
}

export function buildDemoTimestampRefresh(now: Date = new Date()): DemoTimestampRefresh {
  const isoNow = now.toISOString();

  return {
    callStartedAt: isoNow,
    callCreatedAt: isoNow,
    leadCreatedAt: isoNow,
    leadUpdatedAt: isoNow,
  };
}
