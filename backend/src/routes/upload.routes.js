// backend/src/routes/upload.routes.js
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload.middleware");
const {
  requireClerkAuth,
  attachUser,
} = require("../middleware/auth.middleware");

router.use(requireClerkAuth, attachUser);

/**
 * POST /api/upload
 * Accepts multipart/form-data with one or more files under the field name "images".
 * Returns the public URLs (served via the static /uploads route) for each file.
 */
router.post("/", upload.array("images", 10), (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: "NO_FILES", message: "No files were uploaded." },
      });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const imageUrls = req.files.map(
      (file) => `${baseUrl}/uploads/${file.filename}`,
    );

    res.json({ success: true, data: { imageUrls } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
