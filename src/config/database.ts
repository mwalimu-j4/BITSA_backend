import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

// Load environment variables (production or development)
dotenv.config({ path: ".env.production" });

// Create a single Prisma instance with minimal logging
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["warn", "error"] // ✅ No 'query' logs
      : ["error"], // ✅ Silent except for actual errors in production
});

export default prisma;
