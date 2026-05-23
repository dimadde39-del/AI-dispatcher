import { PageHeader } from "@/components/admin/PageHeader";
import { formatDateTime, formatMoneyRange } from "@/components/admin/format";
import { getAdminRepositories } from "../_lib/repositories";
import { createValueReportAction } from "./actions";

export const dynamic = "force-dynamic";

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgoDate(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function ReportsPage() {
  const repositories = getAdminRepositories();
  const [reports, masters] = await Promise.all([
    repositories.valueReports.list(),
    repositories.masters.list(),
  ]);
  const mastersById = new Map(masters.map((master) => [master.id, master]));

  return (
    <>
      <PageHeader
        title="Value reports"
        description="Weekly saved-order reporting for masters."
      />
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Create report</h2>
        <form className="form" action={createValueReportAction}>
          <div className="form-row">
            <label htmlFor="masterId">Master</label>
            <select id="masterId" name="masterId" required>
              {masters.map((master) => (
                <option key={master.id} value={master.id}>
                  {master.name} ({master.tradeType})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-2">
            <div className="form-row">
              <label htmlFor="periodStart">Period start</label>
              <input id="periodStart" name="periodStart" type="date" defaultValue={sevenDaysAgoDate()} required />
            </div>
            <div className="form-row">
              <label htmlFor="periodEnd">Period end</label>
              <input id="periodEnd" name="periodEnd" type="date" defaultValue={todayDate()} required />
            </div>
          </div>
          <button type="submit" disabled={masters.length === 0}>
            Generate report
          </button>
        </form>
      </section>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Master</th>
              <th>Period</th>
              <th>Calls</th>
              <th>Captured</th>
              <th>Accepted</th>
              <th>Estimated saved revenue</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const master = mastersById.get(report.masterId);
              return (
                <tr key={report.id}>
                  <td>{master?.name ?? report.masterId}</td>
                  <td>
                    {report.periodStart} - {report.periodEnd}
                  </td>
                  <td>{report.totalCalls}</td>
                  <td>{report.capturedLeads}</td>
                  <td>{report.acceptedLeads}</td>
                  <td>
                    {formatMoneyRange(
                      report.estimatedSavedRevenueMin,
                      report.estimatedSavedRevenueMax,
                    )}
                  </td>
                  <td>{formatDateTime(report.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
