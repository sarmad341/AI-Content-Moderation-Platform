const express = require("express");
const router = express.Router();
const {
  requireClerkAuth,
  attachUser,
  requireAdmin,
} = require("../middleware/auth.middleware");
const {
  createSubmission,
  listMySubmissions,
  getSubmissionById,
  listFlaggedSubmissions,
} = require("../controllers/submissions.controller");

router.use(requireClerkAuth, attachUser); // every route below requires a logged-in user

router.post("/", createSubmission);
router.get("/", listMySubmissions);
router.get("/admin/flagged", requireAdmin, listFlaggedSubmissions); // must come BEFORE /:id
router.get("/:id", getSubmissionById);

module.exports = router;