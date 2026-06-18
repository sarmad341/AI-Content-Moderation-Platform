require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const PolicyVersion = require("./models/PolicyVersion");
const User = require("./models/User");

/**
 * Seeds the first active PolicyVersion with all six spec categories enabled,
 * using sensible defaults so submissions can actually be tested end to end.
 * Run once during initial setup, or whenever you want to reset to defaults.
 */
async function seed() {
  await connectDB();

  // Need a user to attribute this policy to. If you've already signed in via
  // Clerk at least once, a User doc should exist — grab the first admin if any,
  // otherwise just grab any user. If NONE exist yet, this will fail with a clear message.
  let admin = await User.findOne({ role: "admin" });
  if (!admin) {
    admin = await User.findOne();
  }
  if (!admin) {
    console.error(
      "No User documents exist yet. Sign in to the app at least once via Clerk " +
        "(so lazy-sync creates a User), then re-run this seed script.",
    );
    process.exit(1);
  }

  // Deactivate any existing active policy, just in case this is being re-run.
  await PolicyVersion.updateMany(
    { isActive: true },
    { $set: { isActive: false } },
  );

  const latest = await PolicyVersion.findOne().sort({ version: -1 });
  const nextVersion = latest ? latest.version + 1 : 1;

  const policy = await PolicyVersion.create({
    version: nextVersion,
    isActive: true,
    updatedBy: admin._id,
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

  console.log("Seeded active PolicyVersion:", JSON.stringify(policy, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
