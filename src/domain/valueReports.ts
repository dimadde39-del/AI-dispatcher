import type { TradeType } from "./enums";
import type { Call, Lead } from "./schemas";

export interface TicketRange {
  min: number;
  max: number;
}

export interface ValueReportMetrics {
  totalCalls: number;
  capturedLeads: number;
  acceptedLeads: number;
  estimatedSavedRevenueMin: number;
  estimatedSavedRevenueMax: number;
}

const TICKET_RANGES: Record<TradeType, TicketRange> = {
  PLUMBING: { min: 15000, max: 30000 },
  WASHING_MACHINE_REPAIR: { min: 10000, max: 40000 },
  FRIDGE_REPAIR: { min: 15000, max: 50000 },
  ELECTRICIAN: { min: 10000, max: 35000 },
  LOCKSMITH: { min: 12000, max: 35000 },
  CONDITIONER: { min: 15000, max: 45000 },
  OTHER: { min: 10000, max: 30000 },
};

export function getTicketRange(tradeType: TradeType): TicketRange {
  return TICKET_RANGES[tradeType];
}

export function calculateValueReportMetrics(input: {
  tradeType: TradeType;
  calls: Call[];
  leads: Lead[];
}): ValueReportMetrics {
  const acceptedLeadCount = input.leads.filter((lead) =>
    ["ACCEPTED", "COMPLETED"].includes(lead.status),
  ).length;
  const ticketRange = getTicketRange(input.tradeType);

  return {
    totalCalls: input.calls.length,
    capturedLeads: input.leads.length,
    acceptedLeads: acceptedLeadCount,
    estimatedSavedRevenueMin: acceptedLeadCount * ticketRange.min,
    estimatedSavedRevenueMax: acceptedLeadCount * ticketRange.max,
  };
}
