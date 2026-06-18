const express = require("express");
const router = express.Router();
const {
  requireClerkAuth,
  attachUser,
  requireAdmin,
} = require("../middleware/auth.middleware");
const {
  createAppeal,
  listMyAppeals,
  listAppealQueue,
  resolveAppeal,
} = require("../controllers/appeals.controller");

router.use(requireClerkAuth, attachUser);

router.post("/", createAppeal);
router.get("/mine", listMyAppeals);
router.get("/queue", requireAdmin, listAppealQueue);
router.patch("/:id/resolve", requireAdmin, resolveAppeal);

module.exports = router;
