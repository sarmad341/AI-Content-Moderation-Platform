const mongoose = require("mongoose");

// One result per moderation category, evaluated independently.
const categoryResultSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: [
        "Graphic Violence",
        "Hate Symbols",
        "Self-Harm",
        "Extremist Propaganda",
        "Weapons & Contraband",
        "Harassment & Humiliation",
      ],
    },
    detected: { type: Boolean, required: true },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    reasoning: { type: String, required: true },
    // true only if confidence >= that category's threshold at screening time (business rule 3.1.3)
    triggered: { type: Boolean, required: true },
  },
  { _id: false },
);

// Embedded copy of the active category config at screening time — NOT a ref.
// This is what makes policy changes non-retroactive (business rule 3.2.1).
const policySnapshotSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    categories: [
      {
        name: { type: String, required: true },
        enabled: { type: Boolean, required: true },
        threshold: { type: Number, required: true },
        enforcement: {
          type: String,
          enum: ["Auto-Block", "Flag for Review"],
          required: true,
        },
      },
    ],
  },
  { _id: false },
);

const verdictSchema = new mongoose.Schema({
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Submission",
    index: true,
  },
  imageUrl: { type: String, required: true },
  outcome: {
    type: String,
    enum: ["Approved", "Flagged", "Blocked"],
    required: true,
  },
  policySnapshot: { type: policySnapshotSchema, required: true },
  categoryResults: { type: [categoryResultSchema], required: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model("Verdict", verdictSchema);
