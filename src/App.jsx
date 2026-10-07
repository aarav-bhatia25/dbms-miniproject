import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Droplets } from "lucide-react";
import { api } from "./api";
import Allocation from "./pages/Allocation";
import Farmers from "./pages/Farmers";
import Reports from "./pages/Reports";

export default function App() {
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dataPath = `/data${date ? `?date=${date}` : ""}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setMessage("");
    api(dataPath)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataPath]);

  async function save(path, body, method = "POST") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api(path, { method, body });
      setData(await api(dataPath));
      setMessage(
        result.message ||
          `${result.litres_added.toLocaleString("en-IN")} litres allocated.`,
      );
      return true;
    } catch (error) {
      setError(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <NavLink to="/" className="brand">
            <Droplets size={25} />
            <span>
              CaneFlow<small>Sugarcane irrigation management</small>
            </span>
          </NavLink>
          <span className="project-tag">DBMS mini project</span>
        </div>
      </header>
      <main>
        <div className="nav-row">
          <nav aria-label="Main navigation">
            <NavLink to="/" end>
              Water allocation
            </NavLink>
            <NavLink to="/farmers">Farmers & plots</NavLink>
            <NavLink to="/reports">Reports</NavLink>
          </nav>
          <label className="date-control">
            Date
            <input
              type="date"
              aria-label="Selected date"
              value={date || data?.date || ""}
              disabled={busy}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
        </div>
        {message && (
          <p className="message success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="empty">Loading…</p>
        ) : data ? (
          <Routes>
            <Route
              path="/"
              element={<Allocation data={data} save={save} busy={busy} />}
            />
            <Route
              path="/farmers"
              element={<Farmers data={data} save={save} busy={busy} />}
            />
            <Route path="/reports" element={<Reports data={data} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : (
          <p className="empty">
            Start PostgreSQL, then run <code>npm run db:setup</code>.
          </p>
        )}
        <footer>
          College demonstration · Sample farmers and moisture thresholds · All
          water quantities are in litres.
        </footer>
      </main>
    </>
  );
}
