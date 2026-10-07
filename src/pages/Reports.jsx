import { litres, formatDate } from "../api";

export default function Reports({ data }) {
  return (
    <>
      <div className="page-heading">
        <h1>Reports</h1>
        <p>Simple summaries calculated with SQL joins and GROUP BY.</p>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Allocation by farmer</h2>
          <span>{formatDate(data.date)}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Farmer</th>
                <th>Requests</th>
                <th>Requested</th>
                <th>Allocated</th>
              </tr>
            </thead>
            <tbody>
              {data.reports.farmers.map((f) => (
                <tr key={f.farmer}>
                  <td>{f.farmer}</td>
                  <td>{f.requests}</td>
                  <td>{litres(f.requested_litres)}</td>
                  <td>{litres(f.allocated_litres)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="sql-details">
          <summary>Show SQL query</summary>
          <pre>{data.reportSql.farmers}</pre>
        </details>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Daily water summary</h2>
        </div>
        {data.reports.days.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supply</th>
                  <th>Allocated</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.days.map((day) => (
                  <tr key={day.budget_date}>
                    <td>{formatDate(day.budget_date)}</td>
                    <td>{litres(day.total_litres)}</td>
                    <td>{litres(day.allocated_litres)}</td>
                    <td>{litres(day.remaining_litres)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No budgets yet.</p>
        )}
        <details className="sql-details">
          <summary>Show SQL query</summary>
          <pre>{data.reportSql.days}</pre>
        </details>
      </section>
    </>
  );
}
