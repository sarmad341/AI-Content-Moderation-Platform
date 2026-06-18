import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../../api/client";

function AppealsQueue() {
  const { getToken } = useAuth();

  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Per-appeal response text, keyed by appeal ID, so each card has its own input
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

      // Refetch the whole queue — never assume local state, the resolved
      // appeal should now genuinely disappear from the Pending queue.
      await loadQueue();
    } catch (err) {
      alert(`Failed to resolve: ${err.message}`); // simple for now, restyle as a toast in Cursor
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div>
      <h2>Appeals Queue ({queue.length} pending)</h2>

      {queue.length === 0 ? (
        <p>No pending appeals. The queue is clear.</p>
      ) : (
        queue.map((appeal) => (
          <div
            key={appeal._id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <p>
              <strong>Submission ID:</strong> {appeal.submissionId}
            </p>
            <p>
              <strong>Filed by user:</strong> {appeal.userId}
            </p>
            <p>
              <strong>Filed:</strong>{" "}
              {new Date(appeal.createdAt).toLocaleString()}
            </p>
            <p>
              <strong>Justification:</strong> {appeal.justification}
            </p>

            <textarea
              placeholder="Optional response to the user..."
              value={responses[appeal._id] || ""}
              onChange={(e) => setResponseFor(appeal._id, e.target.value)}
              rows={2}
              style={{ width: "100%", marginTop: "0.5rem" }}
            />

            <div
              style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}
            >
              <button
                onClick={() => handleResolve(appeal._id, "Accepted")}
                disabled={resolvingId === appeal._id}
                style={{ background: "#d4f4dd" }}
              >
                {resolvingId === appeal._id ? "Processing..." : "Accept"}
              </button>
              <button
                onClick={() => handleResolve(appeal._id, "Rejected")}
                disabled={resolvingId === appeal._id}
                style={{ background: "#f4d4d4" }}
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
