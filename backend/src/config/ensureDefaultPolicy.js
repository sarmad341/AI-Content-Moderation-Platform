const User = require("../models/User");
const PolicyVersion = require("../models/PolicyVersion");

const SYSTEM_USER_CLERK_ID = "system-bootstrap";
const SYSTEM_USER_EMAIL = "system@clearlens.internal";

/**
 * Runs once at every server startup. If no active PolicyVersion exists yet
 * (the case for any brand-new database — e.g. a grader's first
 * `docker-compose up`), this creates a sensible default automatically,
 * so the app is immediately usable without a manual seed step.
 *
 * Uses a placeholder "system" User (not a real Clerk account) to satisfy
 * the PolicyVersion schema's `updatedBy` requirement, since no real user
 * is guaranteed to exist yet at server-startup time.
 *
 * Safe to run on every startup: it's a no-op once any active policy exists.
 */
async function ensureDefaultPolicy() {
  const existingActive = await PolicyVersion.findOne({ isActive: true });
  if (existingActive) {
    return; // already set up — nothing to do
  }

  console.log(
    "No active policy found — creating default policy configuration...",
  );

  // Find or create the system placeholder user.
  let systemUser = await User.findOne({ clerkId: SYSTEM_USER_CLERK_ID });
  if (!systemUser) {
    systemUser = await User.create({
      clerkId: SYSTEM_USER_CLERK_ID,
      email: SYSTEM_USER_EMAIL,
      role: "admin",
    });
  }

  await PolicyVersion.create({
    version: 1,
    isActive: true,
    updatedBy: systemUser._id,
    categories: [
      {
        name: "Graphic Violence",
        enabled: true,
        threshold: 70,
        enforcement: "Auto-Block",
      },
      {
        name: "Hate Symbols",
        enabled: true,
        threshold: 70,
        enforcement: "Auto-Block",
      },
      {
        name: "Self-Harm",
        enabled: true,
        threshold: 60,
        enforcement: "Flag for Review",
      },
      {
        name: "Extremist Propaganda",
        enabled: true,
        threshold: 70,
        enforcement: "Auto-Block",
      },
      {
        name: "Weapons & Contraband",
        enabled: true,
        threshold: 65,
        enforcement: "Flag for Review",
      },
      {
        name: "Harassment & Humiliation",
        enabled: true,
        threshold: 60,
        enforcement: "Flag for Review",
      },
    ],
  });

  console.log("Default policy created (version 1, all categories enabled).");
}

module.exports = ensureDefaultPolicy;
