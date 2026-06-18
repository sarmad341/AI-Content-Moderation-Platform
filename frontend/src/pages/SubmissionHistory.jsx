import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../api/client";

function SubmissionHistory() {
  const { getToken } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
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

      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiRequest(`/submissions${query}`, { getToken });
      setSubmissions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Fetch on initial mount, and whenever filters change.
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

  return (
    <div>
      <h2>My Submission History</h2>

      {/* Filter controls — plain markup, restyle freely in Cursor */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          margin: "1rem 0",
        }}
      >
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Approved">Approved</option>
          <option value="Flagged">Flagged</option>
          <option value="Blocked">Blocked</option>
        </select>

        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label>
          From:{" "}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </label>
        <label>
          To:{" "}
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </label>

        <button onClick={clearFilters}>Clear filters</button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && !error && submissions.length === 0 && (
        <p>No submissions found matching these filters.</p>
      )}

      {!loading && !error && submissions.length > 0 && (
        <div>
          {submissions.map((s) => (
            <div
              key={s._id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1rem",
              }}
            >
              <p>
                <strong>Status:</strong>{" "}
                <span
                  style={{
                    color:
                      s.overallStatus === "Approved"
                        ? "green"
                        : s.overallStatus === "Flagged"
                          ? "orange"
                          : "red",
                  }}
                >
                  {s.overallStatus}
                </span>
              </p>
              <p>
                <strong>Submitted:</strong>{" "}
                {new Date(s.submittedAt).toLocaleString()}
              </p>
              <p>
                <strong>Images:</strong> {s.images.length}
              </p>
              <ul>
                {s.images.map((img, i) => (
                  <li key={i}>
                    <a href={img.imageUrl} target="_blank" rel="noreferrer">
                      Image {i + 1}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SubmissionHistory;
