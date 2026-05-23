import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime } from "@/components/admin/format";
import { getAdminRepositories } from "../_lib/repositories";

export const dynamic = "force-dynamic";

export default async function NumbersPage() {
  const repositories = getAdminRepositories();
  const [numbers, masters] = await Promise.all([
    repositories.aiNumbers.list(),
    repositories.masters.list(),
  ]);
  const mastersById = new Map(masters.map((master) => [master.id, master]));

  return (
    <>
      <PageHeader
        title="AI numbers"
        description="Phone numbers reserved for call forwarding into the AI dispatcher."
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Phone number</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Assigned master</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {numbers.map((number) => {
              const master = number.masterId ? mastersById.get(number.masterId) : null;
              return (
                <tr key={number.id}>
                  <td>{number.phoneNumber}</td>
                  <td>
                    {number.provider}
                    <br />
                    <span className="muted">{number.providerNumberId ?? "-"}</span>
                  </td>
                  <td>
                    <StatusBadge status={number.status} />
                  </td>
                  <td>
                    {master ? (
                      <Link href={`/admin/masters/${master.id}`}>{master.name}</Link>
                    ) : (
                      <span className="muted">Available</span>
                    )}
                  </td>
                  <td>{formatDateTime(number.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
