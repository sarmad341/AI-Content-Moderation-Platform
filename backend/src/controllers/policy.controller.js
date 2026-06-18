const PolicyVersion = require("../models/PolicyVersion");
const { AppError } = require("../middleware/errorHandler.middleware");

const VALID_CATEGORIES = [
  "Graphic Violence",
  "Hate Symbols",
  "Self-Harm",
  "Extremist Propaganda",
  "Weapons & Contraband",
  "Harassment & Humiliation",
];

/**
 * Validates the shape of the categories array sent by an admin, before
 * we let it become a new PolicyVersion. Mongoose's schema enums catch some
 * of this too, but checking explicitly here gives much clearer error messages.
 */
function validateCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new AppError(
      "categories must be a non-empty array.",
      400,
      "INVALID_CATEGORIES",
    );
  }

  const seenNames = new Set();

  for (const cat of categories) {
    if (!VALID_CATEGORIES.includes(cat.name)) {
      throw new AppError(
        `Unknown category: "${cat.name}"`,
        400,
        "INVALID_CATEGORY_NAME",
      );
    }
    if (seenNames.has(cat.name)) {
      throw new AppError(
        `Duplicate category: "${cat.name}"`,
        400,
        "DUPLICATE_CATEGORY",
      );
    }
    seenNames.add(cat.name);

    if (
      typeof cat.threshold !== "number" ||
      cat.threshold < 0 ||
      cat.threshold > 100
    ) {
      throw new AppError(
        `threshold for "${cat.name}" must be a number between 0 and 100.`,
        400,
        "INVALID_THRESHOLD",
      );
    }
    if (!["Auto-Block", "Flag for Review"].includes(cat.enforcement)) {
      throw new AppError(
        `enforcement for "${cat.name}" must be "Auto-Block" or "Flag for Review".`,
        400,
        "INVALID_ENFORCEMENT",
      );
    }
    if (typeof cat.enabled !== "boolean") {
      throw new AppError(
        `enabled for "${cat.name}" must be true or false.`,
        400,
        "INVALID_ENABLED",
      );
    }
  }
}

/**
 * GET /api/policy/active
 * Admin-only. Returns the currently active policy configuration.
 */
async function getActivePolicy(req, res, next) {
  try {
    const policy = await PolicyVersion.findOne({ isActive: true });
    if (!policy) {
      throw new AppError("No active policy found.", 404, "NO_ACTIVE_POLICY");
    }
    res.json({ success: true, data: policy });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/policy
 * Admin-only. Body: { categories: [...] }
 *
 * Creates a NEW PolicyVersion rather than mutating the existing one — this is
 * what guarantees business rule 3.2.1 (changes apply only to future
 * submissions, never retroactively) actually holds true, since past Verdicts
 * already snapshot the version that was active when they were created.
 */
async function updatePolicy(req, res, next) {
  try {
    const { categories } = req.body;
    validateCategories(categories);

    const previousActive = await PolicyVersion.findOne({ isActive: true });
    const nextVersion = previousActive ? previousActive.version + 1 : 1;

    // Deactivate the old version first — never mutate its categories array,
    // it must stay exactly as it was for any Verdict that already snapshot it.
    if (previousActive) {
      previousActive.isActive = false;
      await previousActive.save();
    }

    const newPolicy = await PolicyVersion.create({
      version: nextVersion,
      isActive: true,
      updatedBy: req.user._id,
      categories,
    });

    res.status(201).json({ success: true, data: newPolicy });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/policy/history
 * Admin-only. All past policy versions, newest first, for audit visibility.
 */
async function getPolicyHistory(req, res, next) {
  try {
    const history = await PolicyVersion.find().sort({ version: -1 });
    res.json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
}

module.exports = { getActivePolicy, updatePolicy, getPolicyHistory };
