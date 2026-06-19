// frontend/src/pages/admin/FlaggedQueue.jsx
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../../api/client";
import Loading from "../../components/Loading";
import { statusBadgeClass } from "../../utils/status";

function FlaggedQueue() {
  const { getToken } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest("/submissions/admin/flagged", { getToken });
      setSubmissions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="alert alert--error">Error: {error}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Flagged & Blocked Submissions</h2>
        <p>{submissions.length} submission{submissions.length !== 1 ? "s" : ""} requiring oversight, platform-wide</p>
      </div>

      {submissions.length === 0 ? (
        <div className="empty-state">
          <p>No Flagged or Blocked submissions right now.</p>
        </div>
      ) : (
        submissions.map((s) => (
          <div key={s._id} className="card">
            <div className="card__header">
              <span className="card__title">{s.userId?.email || "Unknown user"}</span>
              <span className={statusBadgeClass(s.overallStatus)}>{s.overallStatus}</span>
            </div>
            <div className="meta-row">
              <span className="meta-row__label">Submitted</span>
              <span className="meta-row__value">{new Date(s.submittedAt).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
              {s.images.map((img, i) => (
                <img
                  key={i}
                  src={img.imageUrl}
                  alt={`Submission image ${i + 1}`}
                  style={{ width: "64px", height: "64px", objectFit: "cover", borderRadius: "8px", border: "1px solid #ddd" }}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default FlaggedQueue;