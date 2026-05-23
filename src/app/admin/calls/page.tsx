import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime } from "@/components/admin/format";
import { getAdminRepositories } from "../_lib/repositories";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const repositories = getAdminRepositories();
  const calls = await repositories.calls.list();

  return (
    <>
      <PageHeader
        title="Calls"
        description="Provider-neutral call records from voice webhooks."
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Provider call</th>
              <th>Customer</th>
              <th>AI number</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Transcript</th>
              <th>Recording</th>
              <th>Started</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr key={call.id}>
                <td>
                  {call.provider}
                  <br />
                  <span className="muted">{call.providerCallId}</span>
                </td>
                <td>{call.customerPhone ?? "-"}</td>
                <td>{call.aiNumber ?? "-"}</td>
                <td>
                  <StatusBadge status={call.status} />
                </td>
                <td>{call.durationSeconds ?? "-"} sec</td>
                <td>{call.transcript ? <span className="badge badge-success">Present</span> : "-"}</td>
                <td>
                  {call.recordingUrl ? (
                    <a href={call.recordingUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{formatDateTime(call.startedAt)}</td>
                <td>{formatDateTime(call.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
