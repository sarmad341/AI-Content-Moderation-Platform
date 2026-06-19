const STATUS_BADGE = {
  Approved: "badge badge--approved",
  Flagged: "badge badge--flagged",
  Blocked: "badge badge--blocked",
  Accepted: "badge badge--approved",
  Rejected: "badge badge--blocked",
  Pending: "badge badge--pending",
};

export function statusBadgeClass(status) {
  return STATUS_BADGE[status] || "badge";
}
