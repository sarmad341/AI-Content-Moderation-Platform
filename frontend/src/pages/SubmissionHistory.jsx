import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../api/client";
import Loading from "../components/Loading";
import { statusBadgeClass } from "../utils/status";

function SubmissionHistory() {
  const { getToken } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const CATEGORIES = [
    "Graphic Violence",
    "Hate Symbols",
    "Self-Harm",
    "Extremist Propaganda",
    "Weapons & Contraband",
    "Harassment & Humiliation",
  ];

  async function fetchSubmissions() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (category) params.append("category", category);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const query = params.toString() ? "?" + params.toString() : "";
      const data = await apiRequest("/submissions" + query, { getToken });
      setSubmissions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category, dateFrom, dateTo]);

  function clearFilters() {
    setStatus("");
    setCategory("");
    setDateFrom("");
    setDateTo("");
  }

  function renderThumbnails(images) {
    return images.map(function (img, i) {
      return (
        <a key={i} href={img.imageUrl} target="_blank" rel="noreferrer">
          <img
            src={img.imageUrl}
            alt={"Submission image " + (i + 1)}
            style={{
              width: "64px",
              height: "64px",
              objectFit: "cover",
              borderRadius: "8px",
              border: "1px solid #ddd",
            }}
          />
        </a>
      );
    });
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>My Submission History</h2>
        <p>View and filter your past image submissions.</p>
      </div>

      <div className="filters-bar">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="filter-status">
            Status
          </label>
          <select
            id="filter-status"
            className="form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="Approved">Approved</option>
            <option value="Flagged">Flagged</option>
            <option value="Blocked">Blocked</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="filter-category">
            Category
          </label>
          <select
            id="filter-category"
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="filter-from">
            From
          </label>
          <input
            id="filter-from"
            type="date"
            className="form-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="filter-to">
            To
          </label>
          <input
            id="filter-to"
            type="date"
            className="form-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn--secondary"
          onClick={clearFilters}
        >
          Clear filters
        </button>
      </div>

      {loading && <Loading />}
      {error && <div className="alert alert--error">Error: {error}</div>}

      {!loading && !error && submissions.length === 0 && (
        <div className="empty-state">
          <p>No submissions found matching these filters.</p>
        </div>
      )}

      {!loading && !error && submissions.length > 0 && (
        <div>
          {submissions.map((s) => (
            <div key={s._id} className="card">
              <div className="card__header">
                <span className="card__title">
                  {new Date(s.submittedAt).toLocaleString()}
                </span>
                <span className={statusBadgeClass(s.overallStatus)}>
                  {s.overallStatus}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-row__label">Images</span>
                <span className="meta-row__value">{s.images.length}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "0.75rem",
                  flexWrap: "wrap",
                }}
              >
                {renderThumbnails(s.images)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SubmissionHistory;
