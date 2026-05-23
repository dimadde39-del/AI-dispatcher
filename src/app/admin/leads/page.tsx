import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime } from "@/components/admin/format";
import { getAdminRepositories } from "../_lib/repositories";
import { acceptLeadAction, markLeadAsSpamAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const repositories = getAdminRepositories();
  const leads = await repositories.leads.list();

  return (
    <>
      <PageHeader
        title="Leads"
        description="Extracted customer requests captured from missed or busy calls."
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Problem</th>
              <th>Customer</th>
              <th>Urgency</th>
              <th>Score</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <strong>{lead.problem}</strong>
                  <br />
                  <span className="muted">{lead.address ?? "No address yet"}</span>
                </td>
                <td>
                  {lead.customerName ?? "-"}
                  <br />
                  <span className="muted">{lead.customerPhone ?? "-"}</span>
                </td>
                <td>{lead.urgency}</td>
                <td>{lead.aiScore}</td>
                <td>
                  <StatusBadge status={lead.status} />
                </td>
                <td>{formatDateTime(lead.createdAt)}</td>
                <td>
                  <div className="actions">
                    {lead.status === "NEW" || lead.status === "CALLBACK_PENDING" ? (
                      <>
                        <form action={acceptLeadAction}>
                          <input type="hidden" name="leadId" value={lead.id} />
                          <button type="submit">Accept</button>
                        </form>
                        <form action={markLeadAsSpamAction}>
                          <input type="hidden" name="leadId" value={lead.id} />
                          <button type="submit" className="button-danger">
                            Spam
                          </button>
                        </form>
                      </>
                    ) : (
                      <span className="muted">No action</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
