const {
  clerkMiddleware,
  requireAuth,
  clerkClient,
  getAuth,
} = require("@clerk/express");
const User = require("../models/User");

const clerkAuth = clerkMiddleware();
const requireClerkAuth = requireAuth();

async function attachUser(req, res, next) {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth?.userId;

    if (!clerkUserId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHENTICATED", message: "No valid session." },
      });
    }

    let user = await User.findOne({ clerkId: clerkUserId });

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses?.[0]?.emailAddress;
      const role =
        clerkUser.publicMetadata?.role === "admin" ? "admin" : "user";

      try {
        user = await User.create({ clerkId: clerkUserId, email, role });
      } catch (createErr) {
        // Race condition: another concurrent request created this exact user
        // between our findOne() check and this create() call. That's fine —
        // just fetch the user that the other request already created.
        if (createErr.code === 11000) {
          user = await User.findOne({ clerkId: clerkUserId });
        } else {
          throw createErr;
        }
      }
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("attachUser error:", err);
    res.status(500).json({
      success: false,
      error: { code: "AUTH_SYNC_FAILED", message: "Could not resolve user." },
    });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Admin access required." },
    });
  }
  next();
}

module.exports = { clerkAuth, requireClerkAuth, attachUser, requireAdmin };
