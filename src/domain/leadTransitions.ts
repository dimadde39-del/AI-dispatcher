import type { Lead } from "./schemas";

const ACCEPTABLE_STATUSES = ["NEW", "CALLBACK_PENDING"] as const;
const SPAMMABLE_STATUSES = ["NEW", "CALLBACK_PENDING", "LOST"] as const;

export function acceptLeadTransition(lead: Lead, acceptedAt: string): Lead {
  if (!ACCEPTABLE_STATUSES.includes(lead.status as (typeof ACCEPTABLE_STATUSES)[number])) {
    throw new Error(`Lead ${lead.id} cannot be accepted from status ${lead.status}.`);
  }

  return {
    ...lead,
    status: "ACCEPTED",
    acceptedAt,
  };
}

export function markLeadAsSpamTransition(lead: Lead): Lead {
  if (!SPAMMABLE_STATUSES.includes(lead.status as (typeof SPAMMABLE_STATUSES)[number])) {
    throw new Error(`Lead ${lead.id} cannot be marked as spam from status ${lead.status}.`);
  }

  return {
    ...lead,
    status: "SPAM",
  };
}
