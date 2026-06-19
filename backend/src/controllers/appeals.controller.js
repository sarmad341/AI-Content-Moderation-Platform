const Appeal = require("../models/Appeal");
const Submission = require("../models/Submission");
const Verdict = require("../models/Verdict");
const { computeOverallStatus } = require("../services/verdict.service");
const { AppError } = require("../middleware/errorHandler.middleware");

/**
 * POST /api/appeals
 * Body: { submissionId, justification }
 *
 * Business rules enforced here:
 * 3.3.1 - only Flagged or Blocked submissions can be appealed
 * 3.3.2 - justification must be non-empty
 * 3.3.3 - at most one open (Pending) appeal per submission
 */
async function createAppeal(req, res, next) {
  try {
    const { submissionId, justification } = req.body;

    if (!justification || !justification.trim()) {
      throw new AppError(
        "A written justification is required.",
        400,
        "MISSING_JUSTIFICATION",
      );
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      throw new AppError("Submission not found.", 404, "NOT_FOUND");
    }

    // Only the submission's own owner can appeal it.
    if (submission.userId.toString() !== req.user._id.toString()) {
      throw new AppError(
        "You can only appeal your own submissions.",
        403,
        "FORBIDDEN",
      );
    }

    // Rule 3.3.1 — eligibility check.
    if (submission.overallStatus === "Approved") {
      throw new AppError(
        "Only Flagged or Blocked submissions can be appealed.",
        400,
        "NOT_APPEALABLE",
      );
    }

    // Rule 3.3.3 — at most one open appeal per submission.
    const existingOpenAppeal = await Appeal.findOne({
      submissionId,
      status: "Pending",
    });
    if (existingOpenAppeal) {
      throw new AppError(
        "An appeal is already pending for this submission.",
        409,
        "APPEAL_ALREADY_OPEN",
      );
    }

    const appeal = await Appeal.create({
      submissionId,
      userId: req.user._id,
      justification: justification.trim(),
      status: "Pending",
    });

    res.status(201).json({ success: true, data: appeal });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appeals/mine
 * All appeals filed by the current user, for status tracking.
 */
async function listMyAppeals(req, res, next) {
  try {
    const appeals = await Appeal.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    res.json({ success: true, data: appeals });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appeals/queue
 * Admin-only. All Pending appeals, oldest first (fairness — first filed, first reviewed).
 * Populated with submission and user context so admins aren't just looking at raw IDs.
 */
async function listAppealQueue(req, res, next) {
  try {
    const appeals = await Appeal.find({ status: "Pending" })
      .sort({ createdAt: 1 })
      .populate("userId", "email")
      .populate({
        path: "submissionId",
        select: "overallStatus submittedAt images",
      });

    res.json({ success: true, data: appeals });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appeals/:id/resolve
 * Admin-only. Body: { decision: "Accepted"|"Rejected", adminResponse? }
 *
 * Business rules enforced here:
 * 3.3.5 - admin resolves as Accepted or Rejected, optional written response
 * 3.3.6 - accepting overrides the submission outcome to Approved, ATOMICALLY
 * 3.3.7 - rejecting leaves the original verdict unchanged
 */
async function resolveAppeal(req, res, next) {
  const session = await Appeal.startSession();

  try {
    const { decision, adminResponse } = req.body;

    if (!["Accepted", "Rejected"].includes(decision)) {
      throw new AppError(
        'decision must be "Accepted" or "Rejected".',
        400,
        "INVALID_DECISION",
      );
    }

    let resultAppeal;

    await session.withTransaction(async () => {
      const appeal = await Appeal.findById(req.params.id).session(session);

      if (!appeal) {
        throw new AppError("Appeal not found.", 404, "NOT_FOUND");
      }
      if (appeal.status !== "Pending") {
        throw new AppError(
          "This appeal has already been resolved.",
          400,
          "ALREADY_RESOLVED",
        );
      }

      appeal.status = decision;
      appeal.adminResponse = adminResponse || null;
      appeal.reviewedBy = req.user._id;
      appeal.resolvedAt = new Date();
      await appeal.save({ session });

      // Rule 3.3.6 — only on Accepted does the submission outcome get overridden.
      if (decision === "Accepted") {
        const submission = await Submission.findById(
          appeal.submissionId,
        ).session(session);

        // Override every Verdict tied to this submission to Approved — the
        // appeal is against the submission as a whole, not a single image.
        await Verdict.updateMany(
          { submissionId: submission._id },
          { $set: { outcome: "Approved" } },
          { session },
        );

        const updatedVerdicts = await Verdict.find({
          submissionId: submission._id,
        }).session(session);
        submission.overallStatus = computeOverallStatus(updatedVerdicts);
        await submission.save({ session });
      }

      resultAppeal = appeal;
    });

    res.json({ success: true, data: resultAppeal });
  } catch (err) {
    next(err);
  } finally {
    await session.endSession();
  }
}

module.exports = {
  createAppeal,
  listMyAppeals,
  listAppealQueue,
  resolveAppeal,
};
