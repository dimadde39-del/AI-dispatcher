import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminRepositories } from "./_lib/repositories";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const repositories = getAdminRepositories();
  const [masters, leads, calls, aiNumbers, reports] = await Promise.all([
    repositories.masters.list(),
    repositories.leads.list(),
    repositories.calls.list(),
    repositories.aiNumbers.list(),
    repositories.valueReports.list(),
  ]);
  const acceptedLeads = leads.filter((lead) => lead.status === "ACCEPTED" || lead.status === "COMPLETED");

  return (
    <>
      <PageHeader
        title="Admin overview"
        description="Internal pilot operations for missed-call capture."
        action={
          <Link className="button" href="/admin/masters/new">
            New master
          </Link>
        }
      />
      <section className="grid grid-3">
        <StatCard label="Masters" value={masters.length} />
        <StatCard label="Captured leads" value={leads.length} />
        <StatCard label="Accepted leads" value={acceptedLeads.length} />
        <StatCard label="Calls" value={calls.length} />
        <StatCard label="AI numbers" value={aiNumbers.length} />
        <StatCard label="Reports" value={reports.length} />
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>Recent masters</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Trade</th>
                <th>City</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {masters.slice(0, 5).map((master) => (
                <tr key={master.id}>
                  <td>
                    <Link href={`/admin/masters/${master.id}`}>{master.name}</Link>
                  </td>
                  <td>{master.tradeType}</td>
                  <td>{master.city}</td>
                  <td>
                    <StatusBadge status={master.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
