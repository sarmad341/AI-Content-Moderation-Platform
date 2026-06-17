const mongoose = require("mongoose");

const submissionImageSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true },
    verdictId: { type: mongoose.Schema.Types.ObjectId, ref: "Verdict" },
  },
  { _id: false },
);

const submissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  images: { type: [submissionImageSchema], required: true },
  overallStatus: {
    type: String,
    enum: ["Approved", "Flagged", "Blocked"],
    default: "Approved",
    index: true,
  },
  submittedAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model("Submission", submissionSchema);
