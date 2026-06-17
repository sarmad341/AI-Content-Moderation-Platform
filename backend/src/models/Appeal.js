const mongoose = require("mongoose");

const appealSchema = new mongoose.Schema({
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Submission",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  justification: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
  },
  status: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected"],
    default: "Pending",
    index: true,
  },
  adminResponse: { type: String, default: null },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
});

module.exports = mongoose.model("Appeal", appealSchema);
