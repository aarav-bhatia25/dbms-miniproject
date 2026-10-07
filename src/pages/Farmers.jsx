import { useState } from "react";

export default function Farmers({ data, save, busy }) {
  const [form, setForm] = useState(null);
  async function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const body =
      form === "farmer"
        ? fields
        : {
            ...fields,
            farmer_id: Number(fields.farmer_id),
            area_ha: Number(fields.area_ha),
            rule_id: Number(fields.rule_id),
          };
    if (await save(form === "farmer" ? "/farmers" : "/plots", body))
      setForm(null);
  }
  return (
    <>
      <div className="page-heading">
        <h1>Farmers & plots</h1>
        <p>Register farmers and their sugarcane fields.</p>
      </div>
      <div className="actions">
        <button onClick={() => setForm(form === "farmer" ? null : "farmer")}>
          Add farmer
        </button>
        <button
          className="primary"
          disabled={!data.farmers.length}
          onClick={() => setForm(form === "plot" ? null : "plot")}
        >
          Add plot
        </button>
      </div>
      {form && (
        <form key={form} className="form-panel" onSubmit={submit}>
          <h2>{form === "farmer" ? "New farmer" : "New plot"}</h2>
          {form === "farmer" ? (
            <div className="form-row">
              <label>
                Farmer name
                <input name="name" minLength="2" maxLength="80" required />
              </label>
              <label>
                Village
                <input name="village" minLength="2" maxLength="80" required />
              </label>
            </div>
          ) : (
            <>
              <div className="form-row">
                <label>
                  Farmer
                  <select name="farmer_id" required aria-label="Farmer">
                    {data.farmers.map((f) => (
                      <option key={f.farmer_id} value={f.farmer_id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Plot name
                  <input
                    name="plot_name"
                    minLength="2"
                    maxLength="80"
                    required
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Area (hectares)
                  <input
                    name="area_ha"
                    type="number"
                    min="0.01"
                    max="9999"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Crop stage
                  <select name="rule_id" aria-label="Crop stage" required>
                    {data.rules.map((r) => (
                      <option key={r.rule_id} value={r.rule_id}>
                        {r.crop_stage}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
          <div className="form-actions">
            <button className="primary" disabled={busy}>
              Save {form}
            </button>
            <button type="button" onClick={() => setForm(null)}>
              Close
            </button>
          </div>
        </form>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>Registered plots</h2>
          <span>{data.plots.length} plots</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plot</th>
                <th>Farmer</th>
                <th>Area</th>
                <th>Crop stage</th>
              </tr>
            </thead>
            <tbody>
              {data.plots.map((p) => (
                <tr key={p.plot_id}>
                  <td>{p.plot_name}</td>
                  <td>{p.farmer_name}</td>
                  <td>{p.area_ha} ha</td>
                  <td>{p.crop_stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading">
          <h2>Registered farmers</h2>
          <span>{data.farmers.length} farmers</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Village</th>
              </tr>
            </thead>
            <tbody>
              {data.farmers.map((f) => (
                <tr key={f.farmer_id}>
                  <td>{f.name}</td>
                  <td>{f.village}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
