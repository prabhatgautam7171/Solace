import "dotenv/config";

import app from "./src/app.js";
import connectDB from "./src/config/database.js";
import { startReminderScheduler } from "./src/utils/reminderScheduler.js";


const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Solace AI server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      startReminderScheduler();
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
