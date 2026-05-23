function toneForStatus(status: string): string {
  if (["ACTIVE", "ACCEPTED", "COMPLETED", "ASSIGNED", "TRIAL"].includes(status)) {
    return "badge-success";
  }

  if (["READY_FOR_FORWARDING", "CALLBACK_PENDING", "STARTED", "ENDED", "AVAILABLE"].includes(status)) {
    return "badge-warning";
  }

  if (["FAILED", "LOST", "SPAM", "CHURNED", "DISABLED", "CANCELLED"].includes(status)) {
    return "badge-danger";
  }

  return "badge-neutral";
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${toneForStatus(status)}`}>{status}</span>;
}
