import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../../api/client";
import Loading from "../../components/Loading";

function AppealsQueue() {
  const { getToken } = useAuth();

  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [responses, setResponses] = useState({});
  const [resolvingId, setResolvingId] = useState(null);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest("/appeals/queue", { getToken });
      setQueue(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setResponseFor(appealId, text) {
    setResponses((prev) => ({ ...prev, [appealId]: text }));
  }

  async function handleResolve(appealId, decision) {
    setResolvingId(appealId);
    try {
      await apiRequest(`/appeals/${appealId}/resolve`, {
        method: "PATCH",
        body: { decision, adminResponse: responses[appealId] || "" },
        getToken,
      });

      await loadQueue();
    } catch (err) {
      alert(`Failed to resolve: ${err.message}`);
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) return <Loading />;
  if (error) return <div className="alert alert--error">Error: {error}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Appeals Queue</h2>
        <p>{queue.length} pending appeal{queue.length !== 1 ? "s" : ""}</p>
      </div>

      {queue.length === 0 ? (
        <div className="empty-state">
          <p>No pending appeals. The queue is clear.</p>
        </div>
      ) : (
        queue.map((appeal) => (
          <div key={appeal._id} className="card">
            <div className="card__header">
              <span className="card__title">
                {new Date(appeal.createdAt).toLocaleString()}
              </span>
              <span className="badge badge--pending">Pending</span>
            </div>

            <div className="meta-row">
              <span className="meta-row__label">Submitted by</span>
              <span className="meta-row__value">
                {appeal.userId?.email || "Unknown user"}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-row__label">Submission status</span>
              <span className="meta-row__value">
                {appeal.submissionId?.overallStatus || "—"}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-row__label">Submitted</span>
              <span className="meta-row__value">
                {appeal.submissionId?.submittedAt
                  ? new Date(appeal.submissionId.submittedAt).toLocaleString()
                  : "—"}
              </span>
            </div>

            {appeal.submissionId?.images?.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  margin: "0.75rem 0",
                  flexWrap: "wrap",
                }}
              >
                {appeal.submissionId.images.map((img, i) => (
                  <img
                    key={i}
                    src={img.imageUrl}
                    alt={`Submission image ${i + 1}`}
                    style={{
                      width: "64px",
                      height: "64px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      border: "1px solid #ddd",
                    }}
                  />
                ))}
              </div>
            )}

            <div className="meta-row">
              <span className="meta-row__label">Justification</span>
              <span className="meta-row__value">{appeal.justification}</span>
            </div>

            <div className="form-group" style={{ marginTop: "1rem" }}>
              <label className="form-label" htmlFor={`response-${appeal._id}`}>
                Response to user (optional)
              </label>
              <textarea
                id={`response-${appeal._id}`}
                className="form-textarea"
                placeholder="Optional response to the user..."
                value={responses[appeal._id] || ""}
                onChange={(e) => setResponseFor(appeal._id, e.target.value)}
                rows={2}
              />
            </div>

            <div className="btn-group">
              <button
                type="button"
                className="btn btn--success"
                onClick={() => handleResolve(appeal._id, "Accepted")}
                disabled={resolvingId === appeal._id}
              >
                {resolvingId === appeal._id ? "Processing..." : "Accept"}
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => handleResolve(appeal._id, "Rejected")}
                disabled={resolvingId === appeal._id}
              >
                {resolvingId === appeal._id ? "Processing..." : "Reject"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default AppealsQueue;