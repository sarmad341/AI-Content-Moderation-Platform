const express = require("express");
const router = express.Router();
const {
  requireClerkAuth,
  attachUser,
  requireAdmin,
} = require("../middleware/auth.middleware");
const {
  getActivePolicy,
  updatePolicy,
  getPolicyHistory,
} = require("../controllers/policy.controller");

router.use(requireClerkAuth, attachUser, requireAdmin); // every policy route is admin-only

router.get("/active", getActivePolicy);
router.put("/", updatePolicy);
router.get("/history", getPolicyHistory);

module.exports = router;
