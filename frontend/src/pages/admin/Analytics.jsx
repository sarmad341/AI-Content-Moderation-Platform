import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import apiRequest from "../../api/client";

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

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div>
      <h2>Platform Analytics</h2>

      <section style={{ marginBottom: "2rem" }}>
        <h3>Submission Volume (last 30 days)</h3>
        {volume.volume.length === 0 ? (
          <p>No submissions in this range.</p>
        ) : (
          <ul>
            {volume.volume.map((v) => (
              <li key={v.date}>
                {v.date}: {v.count} submission(s)
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h3>Verdict Distribution</h3>
        <p>
          <strong>By outcome:</strong>
        </p>
        <ul>
          {verdicts.byOutcome.map((v) => (
            <li key={v.outcome}>
              {v.outcome}: {v.count}
            </li>
          ))}
        </ul>
        <p>
          <strong>By category (triggered count):</strong>
        </p>
        {verdicts.byCategory.length === 0 ? (
          <p>No categories have triggered yet.</p>
        ) : (
          <ul>
            {verdicts.byCategory.map((c) => (
              <li key={c.category}>
                {c.category}: {c.triggeredCount}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h3>Appeals</h3>
        <p>
          Total: {appealStats.total} | Pending: {appealStats.pending} |
          Accepted: {appealStats.accepted} | Rejected: {appealStats.rejected}
        </p>
        <p>
          Resolution rate: {appealStats.resolutionRate}% | Acceptance rate (of
          resolved): {appealStats.acceptanceRate}%
        </p>
      </section>

      <section>
        <h3>Top Users</h3>
        <p>
          <strong>By submission count:</strong>
        </p>
        <ul>
          {rankedUsers.bySubmissionCount.map((u) => (
            <li key={u.userId}>
              {u.email}: {u.submissionCount}
            </li>
          ))}
        </ul>
        <p>
          <strong>By violation count (Flagged/Blocked submissions):</strong>
        </p>
        {rankedUsers.byViolationCount.length === 0 ? (
          <p>No violations recorded yet.</p>
        ) : (
          <ul>
            {rankedUsers.byViolationCount.map((u) => (
              <li key={u.userId}>
                {u.email}: {u.violationCount}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default Analytics;
