const Submission = require("../models/Submission");
const Verdict = require("../models/Verdict");
const PolicyVersion = require("../models/PolicyVersion");
const { screenImage } = require("../services/aiScreening.service");
const {
  buildVerdict,
  computeOverallStatus,
} = require("../services/verdict.service");
const { AppError } = require("../middleware/errorHandler.middleware");

/**
 * POST /api/submissions
 * Body: { imageUrls: string[] }
 *
 * Processes images SEQUENTIALLY (not parallel) to stay within the
 * Gemini free tier's rate limit, especially for multi-image submissions.
 */
async function createSubmission(req, res, next) {
  try {
    const { imageUrls } = req.body;

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new AppError(
        "imageUrls must be a non-empty array.",
        400,
        "INVALID_INPUT",
      );
    }

    // 1. Fetch the active policy — this is the snapshot source for every verdict
    // created in this submission (business rule 3.1.8).
    const activePolicy = await PolicyVersion.findOne({ isActive: true });
    if (!activePolicy) {
      throw new AppError(
        "No active policy configuration found. An admin must configure policy first.",
        500,
        "NO_ACTIVE_POLICY",
      );
    }

    const enabledCategories = activePolicy.categories.filter((c) => c.enabled);

    // 2. Process each image sequentially: screen -> build verdict -> save.
    const createdVerdicts = [];

    for (const imageUrl of imageUrls) {
      let categoryResults = [];
      let outcome = "Approved";

      if (enabledCategories.length > 0) {
        const aiResults = await screenImage(imageUrl, enabledCategories);
        const verdictResult = buildVerdict(aiResults, enabledCategories);
        categoryResults = verdictResult.categoryResults;
        outcome = verdictResult.outcome;
      }
      // If no categories are enabled, outcome stays "Approved" with empty results —
      // nothing to screen against, per business rule 3.1.1.

      const verdict = await Verdict.create({
        imageUrl,
        outcome,
        policySnapshot: {
          version: activePolicy.version,
          categories: activePolicy.categories, // full snapshot, not just enabled ones
        },
        categoryResults,
        submissionId: null, // set after Submission is created below
      });

      createdVerdicts.push(verdict);
    }

    // 3. Compute overall status from all verdicts, then create the Submission.
    const overallStatus = computeOverallStatus(createdVerdicts);

    const submission = await Submission.create({
      userId: req.user._id,
      images: createdVerdicts.map((v) => ({
        imageUrl: v.imageUrl,
        verdictId: v._id,
      })),
      overallStatus,
    });

    // 4. Backfill submissionId on each verdict now that we have it.
    await Verdict.updateMany(
      { _id: { $in: createdVerdicts.map((v) => v._id) } },
      { $set: { submissionId: submission._id } },
    );

    res.status(201).json({
      success: true,
      data: {
        submission,
        verdicts: createdVerdicts,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/submissions
 * Returns the current user's own submissions, with optional filters.
 * Query params: status, category, dateFrom, dateTo
 */
async function listMySubmissions(req, res, next) {
  try {
    const { status, dateFrom, dateTo } = req.query;
    const filter = { userId: req.user._id };

    if (status) filter.overallStatus = status;
    if (dateFrom || dateTo) {
      filter.submittedAt = {};
      if (dateFrom) filter.submittedAt.$gte = new Date(dateFrom);
      if (dateTo) filter.submittedAt.$lte = new Date(dateTo);
    }

    const submissions = await Submission.find(filter).sort({ submittedAt: -1 });

    // Category filter requires checking the Verdicts, not the Submission itself —
    // done as a post-filter pass since "category" isn't stored on Submission.
    const { category } = req.query;
    let result = submissions;

    if (category) {
      const verdicts = await Verdict.find({
        submissionId: { $in: submissions.map((s) => s._id) },
        "categoryResults.category": category,
        "categoryResults.triggered": true,
      }).distinct("submissionId");

      const matchingIds = new Set(verdicts.map((id) => id.toString()));
      result = submissions.filter((s) => matchingIds.has(s._id.toString()));
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/submissions/:id
 * Full detail including per-category breakdown. Users can only view their own;
 * admins can view any.
 */
async function getSubmissionById(req, res, next) {
  try {
    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      throw new AppError("Submission not found.", 404, "NOT_FOUND");
    }

    const isOwner = submission.userId.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      throw new AppError(
        "Not authorized to view this submission.",
        403,
        "FORBIDDEN",
      );
    }

    const verdicts = await Verdict.find({ submissionId: submission._id });

    res.json({ success: true, data: { submission, verdicts } });
  } catch (err) {
    next(err);
  }
}

module.exports = { createSubmission, listMySubmissions, getSubmissionById };
