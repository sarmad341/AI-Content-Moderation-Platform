const express = require("express");
const router = express.Router();
const {
  requireClerkAuth,
  attachUser,
  requireAdmin,
} = require("../middleware/auth.middleware");
const {
  getVolume,
  getVerdictDistribution,
  getAppealAnalytics,
  getRankedUsers,
} = require("../controllers/analytics.controller");

router.use(requireClerkAuth, attachUser, requireAdmin); // analytics is admin-only

router.get("/volume", getVolume);
router.get("/verdicts", getVerdictDistribution);
router.get("/appeals", getAppealAnalytics);
router.get("/users/ranked", getRankedUsers);

module.exports = router;
