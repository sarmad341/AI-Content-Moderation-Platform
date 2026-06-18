const Submission = require("../models/Submission");
const Verdict = require("../models/Verdict");
const Appeal = require("../models/Appeal");
const mongoose = require("mongoose");

/**
 * GET /api/analytics/volume?range=7d|30d|90d
 * Submission counts grouped by day, for the requested range.
 */
async function getVolume(req, res, next) {
  try {
    const range = req.query.range || "30d";
    const days = { "7d": 7, "30d": 30, "90d": 90 }[range] || 30;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const volume = await Submission.aggregate([
      { $match: { submittedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", count: 1 } },
    ]);

    res.json({ success: true, data: { range, volume } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/verdicts
 * Distribution by outcome (Approved/Flagged/Blocked) and by category
 * (how often each category was the one that triggered).
 */
async function getVerdictDistribution(req, res, next) {
  try {
    const byOutcome = await Verdict.aggregate([
      { $group: { _id: "$outcome", count: { $sum: 1 } } },
      { $project: { _id: 0, outcome: "$_id", count: 1 } },
    ]);

    const byCategory = await Verdict.aggregate([
      { $unwind: "$categoryResults" },
      { $match: { "categoryResults.triggered": true } },
      {
        $group: {
          _id: "$categoryResults.category",
          triggeredCount: { $sum: 1 },
        },
      },
      { $project: { _id: 0, category: "$_id", triggeredCount: 1 } },
      { $sort: { triggeredCount: -1 } },
    ]);

    res.json({ success: true, data: { byOutcome, byCategory } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/appeals
 * Total volume, resolution rate, and accepted vs rejected breakdown.
 */
async function getAppealAnalytics(req, res, next) {
  try {
    const counts = await Appeal.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const countMap = counts.reduce(
      (acc, c) => ({ ...acc, [c._id]: c.count }),
      {},
    );
    const pending = countMap["Pending"] || 0;
    const accepted = countMap["Accepted"] || 0;
    const rejected = countMap["Rejected"] || 0;
    const total = pending + accepted + rejected;
    const resolved = accepted + rejected;

    res.json({
      success: true,
      data: {
        total,
        pending,
        accepted,
        rejected,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
        acceptanceRate:
          resolved > 0 ? Math.round((accepted / resolved) * 100) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/users/ranked
 * Top users by submission count, and separately by violation count
 * (violation = any submission that was Flagged or Blocked).
 */
async function getRankedUsers(req, res, next) {
  try {
    const bySubmissionCount = await Submission.aggregate([
      { $group: { _id: "$userId", submissionCount: { $sum: 1 } } },
      { $sort: { submissionCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          email: "$user.email",
          submissionCount: 1,
        },
      },
    ]);

    const byViolationCount = await Submission.aggregate([
      { $match: { overallStatus: { $in: ["Flagged", "Blocked"] } } },
      { $group: { _id: "$userId", violationCount: { $sum: 1 } } },
      { $sort: { violationCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$_id",
          email: "$user.email",
          violationCount: 1,
        },
      },
    ]);

    res.json({ success: true, data: { bySubmissionCount, byViolationCount } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getVolume,
  getVerdictDistribution,
  getAppealAnalytics,
  getRankedUsers,
};
