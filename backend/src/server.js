require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const ensureDefaultPolicy = require("./config/ensureDefaultPolicy");

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await ensureDefaultPolicy(); // bootstrap: create a default policy if none exists yet
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start();
