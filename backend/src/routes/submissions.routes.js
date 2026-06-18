const express = require("express");
const router = express.Router();
const {
  requireClerkAuth,
  attachUser,
} = require("../middleware/auth.middleware");
const {
  createSubmission,
  listMySubmissions,
  getSubmissionById,
} = require("../controllers/submissions.controller");

router.use(requireClerkAuth, attachUser); // every route below requires a logged-in user

router.post("/", createSubmission);
router.get("/", listMySubmissions);
router.get("/:id", getSubmissionById);

module.exports = router;
