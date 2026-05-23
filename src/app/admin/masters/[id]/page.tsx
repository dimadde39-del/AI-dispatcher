import { notFound } from "next/navigation";
import { generateForwardingInstructions } from "@/application";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime } from "@/components/admin/format";
import { getAdminRepositories } from "../../_lib/repositories";
import { activateTrialAction, assignAiNumberAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function MasterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repositories = getAdminRepositories();
  const [master, numbers, profiles, subscription] = await Promise.all([
    repositories.masters.getById(id),
    repositories.aiNumbers.list(),
    repositories.assistantProfiles.listByMaster(id),
    repositories.subscriptions.getByMaster(id),
  ]);

  if (!master) {
    notFound();
  }

  const assignedNumber = numbers.find((number) => number.masterId === master.id) ?? null;
  const availableNumbers = numbers.filter((number) => number.status === "AVAILABLE");
  const forwardingInstructions = assignedNumber
    ? generateForwardingInstructions({ phoneNumber: assignedNumber.phoneNumber })
    : null;

  return (
    <>
      <PageHeader
        title={master.name}
        description={`${master.tradeType} in ${master.city}`}
      />
      <section className="grid grid-2">
        <div className="card">
          <h2>Master</h2>
          <p>
            <strong>Phone:</strong> {master.phone}
          </p>
          <p>
            <strong>telegram_chat_id:</strong> {master.telegramChatId ?? "-"}
          </p>
          <p>
            <strong>Telegram readiness:</strong>{" "}
            <StatusBadge status={master.telegramChatId ? "CONFIGURED" : "MISSING"} />
          </p>
          <p>
            <strong>Status:</strong> <StatusBadge status={master.status} />
          </p>
          <p>
            <strong>Created:</strong> {formatDateTime(master.createdAt)}
          </p>
          <form action={activateTrialAction} className="actions">
            <input type="hidden" name="masterId" value={master.id} />
            <button type="submit" className="button-secondary">
              Activate 14-day trial
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Subscription</h2>
          {subscription ? (
            <>
              <p>
                <strong>Status:</strong> <StatusBadge status={subscription.status} />
              </p>
              <p>
                <strong>Plan:</strong> {subscription.planCode}
              </p>
              <p>
                <strong>Trial ends:</strong> {formatDateTime(subscription.trialEndsAt)}
              </p>
            </>
          ) : (
            <p className="muted">No subscription yet.</p>
          )}
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>AI number</h2>
          {assignedNumber ? (
            <>
              <p>
                <strong>Number:</strong> {assignedNumber.phoneNumber}
              </p>
              <p>
                <strong>Status:</strong> <StatusBadge status={assignedNumber.status} />
              </p>
            </>
          ) : (
            <form className="form" action={assignAiNumberAction}>
              <input type="hidden" name="masterId" value={master.id} />
              <div className="form-row">
                <label htmlFor="aiNumberId">Available AI number</label>
                <select id="aiNumberId" name="aiNumberId" required>
                  {availableNumbers.map((number) => (
                    <option key={number.id} value={number.id}>
                      {number.phoneNumber} ({number.provider})
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={availableNumbers.length === 0}>
                Assign number
              </button>
              {availableNumbers.length === 0 ? (
                <p className="muted">No available AI numbers. Run the seed script or add numbers in Supabase.</p>
              ) : null}
            </form>
          )}
        </div>

        <div className="card">
          <h2>Forwarding instructions</h2>
          {forwardingInstructions ? (
            <div className="code-block">
              <code>No answer: {forwardingInstructions.noAnswerCode}</code>
              <code>Busy: {forwardingInstructions.busyCode}</code>
              <code>Disable all: {forwardingInstructions.disableAllCode}</code>
              <span>{forwardingInstructions.shortHumanInstructions}</span>
            </div>
          ) : (
            <p className="muted">Assign an AI number to generate forwarding codes.</p>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Telegram connection</h2>
        <p>
          Early testing uses manual chat id setup. Ask the master to message the bot, read the chat id
          from a trusted diagnostic update, then save it in <code>masters.telegram_chat_id</code>.
        </p>
        <p className="muted">
          Bot onboarding with /start is intentionally deferred; do not put raw provider payloads or
          diagnostic data in Telegram messages.
        </p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Assistant profiles</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Display name</th>
                <th>Language</th>
                <th>Prompt</th>
                <th>Voice provider</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td>{profile.displayName}</td>
                  <td>{profile.language}</td>
                  <td>{profile.promptVersion}</td>
                  <td>{profile.voiceProvider}</td>
                  <td>{profile.isActive ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
