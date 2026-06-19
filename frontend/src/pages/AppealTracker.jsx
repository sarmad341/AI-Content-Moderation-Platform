import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../api/client";
import Loading from "../components/Loading";
import { statusBadgeClass } from "../utils/status";

function AppealTracker() {
  const { getToken } = useAuth();

  const [appeals, setAppeals] = useState([]);
  const [appealableSubmissions, setAppealableSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      await loadData();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <div className="alert alert--error">Error: {error}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>My Appeals</h2>
        <p>Challenge Flagged or Blocked verdicts and track their status.</p>
      </div>

      <div className="card">
        <h3>File a New Appeal</h3>

        {appealableSubmissions.length === 0 ? (
          <div className="empty-state">
            <p>
              You have no Flagged or Blocked submissions eligible for appeal
              right now.
            </p>
          </div>
        ) : (
          <form onSubmit={handleFileAppeal}>
            <div className="form-group">
              <label className="form-label" htmlFor="appeal-submission">
                Submission
              </label>
              <select
                id="appeal-submission"
                className="form-select"
                value={selectedSubmissionId}
                onChange={(e) => setSelectedSubmissionId(e.target.value)}
              >
                <option value="">Select a submission</option>
                {appealableSubmissions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s._id} — {s.overallStatus} —{" "}
                    {new Date(s.submittedAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="appeal-justification">
                Justification
              </label>
              <textarea
                id="appeal-justification"
                className="form-textarea"
                placeholder="Explain why you believe this verdict is incorrect..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
              />
            </div>

            {formError && <div className="alert alert--error">{formError}</div>}

            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Appeal"}
            </button>
          </form>
        )}
      </div>

      <div className="page-section">
        <h3 className="page-section__title">Appeal History</h3>
        {appeals.length === 0 ? (
          <div className="empty-state">
            <p>You haven&apos;t filed any appeals yet.</p>
          </div>
        ) : (
          appeals.map((a) => (
            <div key={a._id} className="card">
              <div className="card__header">
                <span className="card__title">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
                <span className={statusBadgeClass(a.status)}>{a.status}</span>
              </div>
              <div className="meta-row">
                <span className="meta-row__label">Submission ID</span>
                <span className="meta-row__value">{a.submissionId}</span>
              </div>
              <div className="meta-row">
                <span className="meta-row__label">Your justification</span>
                <span className="meta-row__value">{a.justification}</span>
              </div>
              {a.adminResponse && (
                <div className="meta-row">
                  <span className="meta-row__label">Admin response</span>
                  <span className="meta-row__value">{a.adminResponse}</span>
                </div>
              )}
              {a.resolvedAt && (
                <div className="meta-row">
                  <span className="meta-row__label">Resolved</span>
                  <span className="meta-row__value">
                    {new Date(a.resolvedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AppealTracker;
