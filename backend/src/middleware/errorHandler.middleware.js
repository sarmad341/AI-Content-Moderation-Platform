// Centralized error handler — keeps every controller's error responses consistent
// with the envelope defined in the PDR (Section 5.6).
function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Something went wrong.";

  res.status(status).json({
    success: false,
    error: { code, message },
  });
}

// Helper to throw consistent errors from anywhere in the app
class AppError extends Error {
  constructor(message, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = { errorHandler, AppError };
