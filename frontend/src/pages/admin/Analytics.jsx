import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../../api/client";
import Loading from "../../components/Loading";

function Analytics() {
  const { getToken } = useAuth();

  const [volume, setVolume] = useState(null);
  const [verdicts, setVerdicts] = useState(null);
  const [appealStats, setAppealStats] = useState(null);
  const [rankedUsers, setRankedUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const [volumeData, verdictData, appealData, usersData] =
        await Promise.all([
          apiRequest("/analytics/volume?range=30d", { getToken }),
          apiRequest("/analytics/verdicts", { getToken }),
          apiRequest("/analytics/appeals", { getToken }),
          apiRequest("/analytics/users/ranked", { getToken }),
        ]);

      setVolume(volumeData);
      setVerdicts(verdictData);
      setAppealStats(appealData);
      setRankedUsers(usersData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="alert alert--error">Error: {error}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Platform Analytics</h2>
        <p>Overview of submission activity, verdicts, appeals, and users.</p>
      </div>

      <section className="page-section">
        <h3 className="page-section__title">Appeals Overview</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card__label">Total Appeals</div>
            <div className="stat-card__value">{appealStats.total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Pending</div>
            <div className="stat-card__value">{appealStats.pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Accepted</div>
            <div className="stat-card__value">{appealStats.accepted}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Rejected</div>
            <div className="stat-card__value">{appealStats.rejected}</div>
          </div>
        </div>
        <p>
          Resolution rate: <strong>{appealStats.resolutionRate}%</strong> ·
          Acceptance rate (of resolved):{" "}
          <strong>{appealStats.acceptanceRate}%</strong>
        </p>
      </section>

      <section className="page-section">
        <h3 className="page-section__title">
          Submission Volume (last 30 days)
        </h3>
        {volume.volume.length === 0 ? (
          <div className="empty-state">
            <p>No submissions in this range.</p>
          </div>
        ) : (
          <div className="card">
            <ul className="data-list">
              {volume.volume.map((v) => (
                <li key={v.date}>
                  <span>{v.date}</span>
                  <span className="data-list__count">
                    {v.count} submission{v.count !== 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="page-section">
        <h3 className="page-section__title">Verdict Distribution</h3>
        <div className="card">
          <p>
            <strong>By outcome</strong>
          </p>
          <ul className="data-list">
            {verdicts.byOutcome.map((v) => (
              <li key={v.outcome}>
                <span>{v.outcome}</span>
                <span className="data-list__count">{v.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <p>
            <strong>By category (triggered count)</strong>
          </p>
          {verdicts.byCategory.length === 0 ? (
            <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>
              No categories have triggered yet.
            </p>
          ) : (
            <ul className="data-list">
              {verdicts.byCategory.map((c) => (
                <li key={c.category}>
                  <span>{c.category}</span>
                  <span className="data-list__count">{c.triggeredCount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="page-section">
        <h3 className="page-section__title">Top Users</h3>
        <div className="card">
          <p>
            <strong>By submission count</strong>
          </p>
          <ul className="data-list">
            {rankedUsers.bySubmissionCount.map((u) => (
              <li key={u.userId}>
                <span>{u.email}</span>
                <span className="data-list__count">{u.submissionCount}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <p>
            <strong>By violation count (Flagged/Blocked)</strong>
          </p>
          {rankedUsers.byViolationCount.length === 0 ? (
            <p style={{ color: "var(--text-muted)", marginBottom: 0 }}>
              No violations recorded yet.
            </p>
          ) : (
            <ul className="data-list">
              {rankedUsers.byViolationCount.map((u) => (
                <li key={u.userId}>
                  <span>{u.email}</span>
                  <span className="data-list__count">{u.violationCount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default Analytics;
