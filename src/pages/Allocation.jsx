import { useState } from "react";
import { Link } from "react-router-dom";
import { litres } from "../api";

export default function Allocation({ data, save, busy }) {
  const [showRequest, setShowRequest] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [removing, setRemoving] = useState(null);
  const budget = data.budget;
  const availablePlots = data.plots.filter(
    (plot) => !data.requests.some((r) => r.plot_id === plot.plot_id),
  );
  const canAllocate =
    budget?.remaining_litres > 0 &&
    data.requests.some((r) => r.allocated_litres < r.requested_litres);

  async function submitBudget(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (
      await save("/budget", {
        date: data.date,
        total_litres: Number(form.get("total_litres")),
      })
    )
      setShowBudget(false);
  }
  async function submitRequest(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const added = await save("/requests", {
      date: data.date,
      plot_id: Number(form.get("plot_id")),
      moisture_pct: Number(form.get("moisture_pct")),
      requested_litres: Number(form.get("requested_litres")),
    });
    if (added) setShowRequest(false);
  }

  return (
    <>
      <div className="page-heading">
        <h1>Water allocation</h1>
        <p>
          Set the daily supply, add irrigation requests, then share the water by
          priority.
        </p>
      </div>
      <div className="summary-row">
        <div>
          <span>Daily supply</span>
          <strong>{litres(budget?.total_litres)}</strong>
        </div>
        <div>
          <span>Allocated</span>
          <strong>{litres(budget?.allocated_litres)}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{litres(budget?.remaining_litres)}</strong>
        </div>
      </div>
      <div className="actions">
        <button
          disabled={busy || budget?.allocated_litres > 0}
          onClick={() => setShowBudget(!showBudget)}
        >
          {budget ? "Edit budget" : "Set daily budget"}
        </button>
        <button
          disabled={busy || !budget}
          onClick={() => setShowRequest(!showRequest)}
        >
          Add request
        </button>
        <button
          className="primary"
          disabled={busy || !canAllocate}
          onClick={() => save("/allocate", { date: data.date })}
        >
          {busy ? "Saving…" : "Allocate water"}
        </button>
      </div>
      {!budget && (
        <p className="hint">
          No supply has been set for this date. Start with “Set daily budget”.
        </p>
      )}
      {showBudget && (
        <form className="form-panel" onSubmit={submitBudget}>
          <h2>Daily water budget</h2>
          <p className="hint">
            The budget stays fixed after water is allocated.
          </p>
          <div className="form-row">
            <label>
              Water available (litres)
              <input
                name="total_litres"
                type="number"
                min="1"
                max="1000000000"
                step="1"
                defaultValue={budget?.total_litres || 100000}
                required
              />
            </label>
            <button className="primary" disabled={busy}>
              Save budget
            </button>
            <button type="button" onClick={() => setShowBudget(false)}>
              Close
            </button>
          </div>
        </form>
      )}
      {showRequest && (
        <form className="form-panel" onSubmit={submitRequest}>
          <h2>New irrigation request</h2>
          {availablePlots.length ? (
            <>
              <div className="form-row">
                <label>
                  Plot
                  <select name="plot_id" required>
                    {availablePlots.map((plot) => (
                      <option key={plot.plot_id} value={plot.plot_id}>
                        {plot.plot_name} — {plot.farmer_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Soil moisture (%)
                  <input
                    name="moisture_pct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Water needed (litres)
                  <input
                    name="requested_litres"
                    type="number"
                    min="1"
                    max="1000000000"
                    step="1"
                    required
                  />
                </label>
              </div>
              <div className="form-actions">
                <button className="primary" disabled={busy}>
                  Submit request
                </button>
                <button type="button" onClick={() => setShowRequest(false)}>
                  Close
                </button>
              </div>
            </>
          ) : (
            <p className="hint">
              Each plot already has a request for this date.{" "}
              <Link to="/farmers">Add another plot</Link> or select a different
              date.
            </p>
          )}
        </form>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>Irrigation requests</h2>
          <span>
            {data.requests.length} requests · {litres(budget?.requested_litres)}{" "}
            needed
          </span>
        </div>
        {data.requests.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Farmer / plot</th>
                  <th>Moisture</th>
                  <th>Priority</th>
                  <th>Requested</th>
                  <th>Allocated</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map((request) => (
                  <tr key={request.request_id}>
                    <td>
                      <strong>{request.farmer_name}</strong>
                      <small>
                        {request.plot_name} · {request.crop_stage}
                      </small>
                    </td>
                    <td>{request.moisture_pct}%</td>
                    <td>
                      <span
                        className={`priority ${request.priority.toLowerCase()}`}
                      >
                        {request.priority}
                      </span>
                    </td>
                    <td>{litres(request.requested_litres)}</td>
                    <td>{litres(request.allocated_litres)}</td>
                    <td>{request.status}</td>
                    <td>
                      {request.allocated_litres === 0 ? (
                        removing === request.request_id ? (
                          <div className="remove-actions">
                            <button
                              disabled={busy}
                              onClick={async () => {
                                if (
                                  await save(
                                    `/requests/${request.request_id}`,
                                    {},
                                    "DELETE",
                                  )
                                )
                                  setRemoving(null);
                              }}
                            >
                              Confirm
                            </button>
                            <button onClick={() => setRemoving(null)}>
                              Keep
                            </button>
                          </div>
                        ) : (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => setRemoving(request.request_id)}
                          >
                            Remove
                          </button>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            No requests yet. Add one for a registered plot.
          </p>
        )}
      </section>
      <p className="explanation">
        <strong>How it works:</strong> High priority first, then Medium, then
        Low. Ties follow submission order. If water runs short, the next request
        receives what remains.
      </p>
    </>
  );
}
