import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

// Manually load the environment variables for application runtime.
// This ensures that your app connects to the right DB based on environment settings.
dotenv.config({ path: ".env.production" });

const prisma = new PrismaClient({
  // Only log detailed queries in development for better performance in production.
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

export default prisma;
