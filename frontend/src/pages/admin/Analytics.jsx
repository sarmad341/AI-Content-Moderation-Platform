import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import apiRequest from "../../api/client";
import Loading from "../../components/Loading";

const OUTCOME_COLORS = {
  Approved: "#16a34a",
  Flagged: "#d97706",
  Blocked: "#dc2626",
};

const CHART_COLORS = {
  primary: "#2563eb",
  grid: "#e2e8f0",
  axis: "#64748b",
  category: "#3b82f6",
  users: "#6366f1",
  violations: "#dc2626",
};

function formatChartDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, label, valueLabel = "Count" }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="analytics-chart-tooltip">
      {label && <p className="analytics-chart-tooltip__label">{label}</p>}
      <p className="analytics-chart-tooltip__value">
        {valueLabel}: {payload[0].value}
      </p>
    </div>
  );
}

function PieLegend({ data }) {
  return (
    <div className="analytics-legend">
      {data.map((entry) => (
        <span key={entry.outcome} className="analytics-legend__item">
          <span
            className="analytics-legend__swatch"
            style={{ background: OUTCOME_COLORS[entry.outcome] || CHART_COLORS.primary }}
          />
          {entry.outcome} ({entry.count})
        </span>
      ))}
    </div>
  );
}

function barChartHeight(itemCount, min = 220, max = 420) {
  return Math.max(min, Math.min(max, itemCount * 36 + 48));
}

function ChartFrame({ height, children }) {
  return (
    <div
      className="analytics-chart-card__body"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

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

  const volumeData = volume.volume.map((v) => ({
    ...v,
    label: formatChartDate(v.date),
  }));

  const outcomeData = verdicts.byOutcome.filter((v) => v.count > 0);
  const hasOutcomeData = outcomeData.length > 0;

  const categoryData = [...verdicts.byCategory].sort(
    (a, b) => b.triggeredCount - a.triggeredCount,
  );

  const submissionUsers = rankedUsers.bySubmissionCount.map((u) => ({
    email: u.email,
    count: u.submissionCount,
  }));

  const violationUsers = rankedUsers.byViolationCount.map((u) => ({
    email: u.email,
    count: u.violationCount,
  }));

  const categoryChartHeight = barChartHeight(categoryData.length);
  const submissionChartHeight = barChartHeight(submissionUsers.length);
  const violationChartHeight = barChartHeight(violationUsers.length);

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
          <div className="stat-card stat-card--warning">
            <div className="stat-card__label">Pending</div>
            <div className="stat-card__value">{appealStats.pending}</div>
          </div>
          <div className="stat-card stat-card--success">
            <div className="stat-card__label">Accepted</div>
            <div className="stat-card__value">{appealStats.accepted}</div>
          </div>
          <div className="stat-card stat-card--danger">
            <div className="stat-card__label">Rejected</div>
            <div className="stat-card__value">{appealStats.rejected}</div>
          </div>
          <div className="stat-card stat-card--primary">
            <div className="stat-card__label">Resolution Rate</div>
            <div className="stat-card__value">{appealStats.resolutionRate}%</div>
          </div>
          <div className="stat-card stat-card--primary">
            <div className="stat-card__label">Acceptance Rate</div>
            <div className="stat-card__value">{appealStats.acceptanceRate}%</div>
          </div>
        </div>
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
          <div className="analytics-chart-card analytics-chart-card--wide">
            <p className="analytics-chart-card__title">Daily submissions</p>
            <ChartFrame height={280}>
              <LineChart
                data={volumeData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_COLORS.grid }}
                />
                <Tooltip content={<ChartTooltip valueLabel="Submissions" />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.primary, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: CHART_COLORS.primary }}
                />
              </LineChart>
            </ChartFrame>
          </div>
        )}
      </section>

      <section className="page-section">
        <h3 className="page-section__title">Verdict Distribution</h3>
        <div className="analytics-charts-grid">
          <div className="analytics-chart-card">
            <p className="analytics-chart-card__title">By outcome</p>
            {!hasOutcomeData ? (
              <div className="empty-state">
                <p>No verdict data yet.</p>
              </div>
            ) : (
              <>
                <ChartFrame height={280}>
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      dataKey="count"
                      nameKey="outcome"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {outcomeData.map((entry) => (
                        <Cell
                          key={entry.outcome}
                          fill={OUTCOME_COLORS[entry.outcome] || CHART_COLORS.primary}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload;
                        return (
                          <div className="analytics-chart-tooltip">
                            <p className="analytics-chart-tooltip__label">
                              {item.outcome}
                            </p>
                            <p className="analytics-chart-tooltip__value">
                              Count: {item.count}
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ChartFrame>
                <PieLegend data={outcomeData} />
              </>
            )}
          </div>

          <div className="analytics-chart-card">
            <p className="analytics-chart-card__title">
              By category (triggered count)
            </p>
            {verdicts.byCategory.length === 0 ? (
              <div className="empty-state">
                <p>No categories have triggered yet.</p>
              </div>
            ) : (
              <ChartFrame height={categoryChartHeight}>
                <BarChart
                  data={categoryData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    stroke={CHART_COLORS.grid}
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={140}
                    tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="analytics-chart-tooltip">
                          <p className="analytics-chart-tooltip__label">
                            {item.category}
                          </p>
                          <p className="analytics-chart-tooltip__value">
                            Triggered: {item.triggeredCount}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="triggeredCount"
                    fill={CHART_COLORS.category}
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ChartFrame>
            )}
          </div>
        </div>
      </section>

      <section className="page-section">
        <h3 className="page-section__title">Top Users</h3>
        <div className="analytics-charts-grid">
          <div className="analytics-chart-card">
            <p className="analytics-chart-card__title">By submission count</p>
            {submissionUsers.length === 0 ? (
              <div className="empty-state">
                <p>No user data yet.</p>
              </div>
            ) : (
              <ChartFrame height={submissionChartHeight}>
                <BarChart
                  data={submissionUsers}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    stroke={CHART_COLORS.grid}
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                  />
                  <YAxis
                    type="category"
                    dataKey="email"
                    width={120}
                    tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="analytics-chart-tooltip">
                          <p className="analytics-chart-tooltip__label">
                            {item.email}
                          </p>
                          <p className="analytics-chart-tooltip__value">
                            Submissions: {item.count}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS.users}
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ChartFrame>
            )}
          </div>

          <div className="analytics-chart-card">
            <p className="analytics-chart-card__title">
              By violation count (Flagged/Blocked)
            </p>
            {rankedUsers.byViolationCount.length === 0 ? (
              <div className="empty-state">
                <p>No violations recorded yet.</p>
              </div>
            ) : (
              <ChartFrame height={violationChartHeight}>
                <BarChart
                  data={violationUsers}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    stroke={CHART_COLORS.grid}
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: CHART_COLORS.axis, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                  />
                  <YAxis
                    type="category"
                    dataKey="email"
                    width={120}
                    tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="analytics-chart-tooltip">
                          <p className="analytics-chart-tooltip__label">
                            {item.email}
                          </p>
                          <p className="analytics-chart-tooltip__value">
                            Violations: {item.count}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS.violations}
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ChartFrame>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Analytics;
