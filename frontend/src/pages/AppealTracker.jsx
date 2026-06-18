import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../api/client";

function AppealTracker() {
  const { getToken } = useAuth();

  const [appeals, setAppeals] = useState([]);
  const [appealableSubmissions, setAppealableSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New appeal form state
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [myAppeals, mySubmissions] = await Promise.all([
        apiRequest("/appeals/mine", { getToken }),
        apiRequest("/submissions", { getToken }),
      ]);

      setAppeals(myAppeals);

      // Only Flagged/Blocked submissions are appealable (business rule 3.3.1),
      // AND only ones without an existing Pending appeal already (rule 3.3.3).
      const pendingSubmissionIds = new Set(
        myAppeals
          .filter((a) => a.status === "Pending")
          .map((a) => a.submissionId),
      );

      const eligible = mySubmissions.filter(
        (s) =>
          (s.overallStatus === "Flagged" || s.overallStatus === "Blocked") &&
          !pendingSubmissionIds.has(s._id),
      );

      setAppealableSubmissions(eligible);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileAppeal(e) {
    e.preventDefault();
    setFormError(null);

    if (!selectedSubmissionId || !justification.trim()) {
      setFormError("Please select a submission and provide a justification.");
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest("/appeals", {
        method: "POST",
        body: {
          submissionId: selectedSubmissionId,
          justification: justification.trim(),
        },
        getToken,
      });

      setSelectedSubmissionId("");
      setJustification("");
      await loadData(); // refetch — never trust local optimistic state for appeal status
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div>
      <h2>My Appeals</h2>

      {/* File a new appeal */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "1rem",
          marginBottom: "2rem",
        }}
      >
        <h3>File a New Appeal</h3>

        {appealableSubmissions.length === 0 ? (
          <p>
            You have no Flagged or Blocked submissions eligible for appeal right
            now.
          </p>
        ) : (
          <form onSubmit={handleFileAppeal}>
            <div style={{ marginBottom: "0.75rem" }}>
              <label>
                Submission:{" "}
                <select
                  value={selectedSubmissionId}
                  onChange={(e) => setSelectedSubmissionId(e.target.value)}
                >
                  <option value="">-- Select a submission --</option>
                  {appealableSubmissions.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s._id} — {s.overallStatus} —{" "}
                      {new Date(s.submittedAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ marginBottom: "0.75rem" }}>
              <textarea
                placeholder="Explain why you believe this verdict is incorrect..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                style={{ width: "100%" }}
              />
            </div>

            {formError && <p style={{ color: "red" }}>{formError}</p>}

            <button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Appeal"}
            </button>
          </form>
        )}
      </div>

      {/* Appeal history */}
      <h3>Appeal History</h3>
      {appeals.length === 0 ? (
        <p>You haven't filed any appeals yet.</p>
      ) : (
        appeals.map((a) => (
          <div
            key={a._id}
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
                    a.status === "Accepted"
                      ? "green"
                      : a.status === "Rejected"
                        ? "red"
                        : "orange",
                }}
              >
                {a.status}
              </span>
            </p>
            <p>
              <strong>Submission ID:</strong> {a.submissionId}
            </p>
            <p>
              <strong>Filed:</strong> {new Date(a.createdAt).toLocaleString()}
            </p>
            <p>
              <strong>Your justification:</strong> {a.justification}
            </p>
            {a.adminResponse && (
              <p>
                <strong>Admin response:</strong> {a.adminResponse}
              </p>
            )}
            {a.resolvedAt && (
              <p>
                <strong>Resolved:</strong>{" "}
                {new Date(a.resolvedAt).toLocaleString()}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default AppealTracker;
