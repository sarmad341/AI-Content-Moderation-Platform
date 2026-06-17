const express = require("express");
const cors = require("cors");
const { errorHandler } = require("./middleware/errorHandler.middleware");

const app = express();

app.use(cors());
app.use(express.json());

// Health check — useful once you Dockerize, to confirm the container is alive
app.get("/health", (req, res) =>
  res.json({ success: true, data: { status: "ok" } }),
);

// Routes will be mounted here in later phases, e.g.:
// app.use("/api/policy", require("./routes/policy.routes"));
// app.use("/api/submissions", require("./routes/submissions.routes"));
// app.use("/api/appeals", require("./routes/appeals.routes"));
// app.use("/api/analytics", require("./routes/analytics.routes"));

// Must be registered LAST — Express only treats this as an error handler
// because it has 4 args (err, req, res, next).
app.use(errorHandler);

module.exports = app;
