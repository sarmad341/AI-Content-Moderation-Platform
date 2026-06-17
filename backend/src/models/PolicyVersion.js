const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
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
    enabled: { type: Boolean, default: true },
    threshold: { type: Number, required: true, min: 0, max: 100 },
    enforcement: {
      type: String,
      enum: ["Auto-Block", "Flag for Review"],
      required: true,
    },
  },
  { _id: false }, // categories are embedded sub-docs, don't need their own _id
);

const policyVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true, unique: true },
  isActive: { type: Boolean, default: false, index: true },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  updatedAt: { type: Date, default: Date.now },
  categories: { type: [categorySchema], required: true },
});

module.exports = mongoose.model("PolicyVersion", policyVersionSchema);
