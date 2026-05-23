import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDateTime } from "@/components/admin/format";
import { getAdminRepositories } from "../_lib/repositories";

export const dynamic = "force-dynamic";

export default async function MastersPage() {
  const repositories = getAdminRepositories();
  const masters = await repositories.masters.list();

  return (
    <>
      <PageHeader
        title="Masters"
        description="Field service masters connected to the missed-call capture pilot."
        action={
          <Link className="button" href="/admin/masters/new">
            New master
          </Link>
        }
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Trade</th>
              <th>City</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {masters.map((master) => (
              <tr key={master.id}>
                <td>
                  <Link href={`/admin/masters/${master.id}`}>{master.name}</Link>
                </td>
                <td>{master.phone}</td>
                <td>{master.tradeType}</td>
                <td>{master.city}</td>
                <td>
                  <StatusBadge status={master.status} />
                </td>
                <td>{formatDateTime(master.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
