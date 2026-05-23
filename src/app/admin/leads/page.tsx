import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime } from "@/components/admin/format";
import { hasTelegramBotToken } from "@/infrastructure/telegram";
import { getAdminRepositories } from "../_lib/repositories";
import { acceptLeadAction, markLeadAsSpamAction, sendTelegramLeadCardAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const repositories = getAdminRepositories();
  const [leads, masters] = await Promise.all([
    repositories.leads.list(),
    repositories.masters.list(),
  ]);
  const telegramMessagesByLead = new Map(
    await Promise.all(
      leads.map(async (lead) => [lead.id, await repositories.telegramMessages.listByLead(lead.id)] as const),
    ),
  );
  const mastersById = new Map(masters.map((master) => [master.id, master]));
  const telegramTokenConfigured = hasTelegramBotToken();

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
              <th>Telegram</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const master = mastersById.get(lead.masterId);
              const telegramMessages = telegramMessagesByLead.get(lead.id) ?? [];
              const telegramDisabledReason = !telegramTokenConfigured
                ? "Bot token missing"
                : !master?.telegramChatId
                  ? "No telegram_chat_id"
                  : null;

              return (
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
                  <td>
                    {telegramMessages.length > 0 ? (
                      <>
                        <span className="badge badge-success">Sent</span>
                        <br />
                        <span className="muted">{telegramMessages.length} message(s)</span>
                      </>
                    ) : (
                      <span className="badge badge-neutral">Not sent</span>
                    )}
                  </td>
                  <td>{formatDateTime(lead.createdAt)}</td>
                  <td>
                    <div className="actions">
                      {telegramDisabledReason ? (
                        <>
                          <button type="button" disabled>
                            Send Telegram card
                          </button>
                          <span className="muted">{telegramDisabledReason}</span>
                        </>
                      ) : (
                        <form action={sendTelegramLeadCardAction}>
                          <input type="hidden" name="leadId" value={lead.id} />
                          <button type="submit">
                            {telegramMessages.length > 0 ? "Resend Telegram card" : "Send Telegram card"}
                          </button>
                        </form>
                      )}
                      {lead.status === "NEW" || lead.status === "CALLBACK_PENDING" ? (
                        <>
                          <form action={acceptLeadAction}>
                            <input type="hidden" name="leadId" value={lead.id} />
                            <button type="submit" className="button-secondary">
                              Accept
                            </button>
                          </form>
                          <form action={markLeadAsSpamAction}>
                            <input type="hidden" name="leadId" value={lead.id} />
                            <button type="submit" className="button-danger">
                              Spam
                            </button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
