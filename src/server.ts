import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import chalk from "chalk";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes";
import blogRoutes from "./routes/blog.routes";
import eventRoutes from "./routes/event.routes";
import galleryRoutes from "./routes/gallery.routes";
import studentSettingsRoutes from "./routes/student-settings.routes";
import adminRoutes from "./routes/admin.routes";

import { CloudinaryUtil } from "./utils/cloudinary.util";
import { handleMulterError } from "./middlewares/upload.middleware";
import { PrismaClient } from "@prisma/client";

// Load environment variables
dotenv.config({ path: ".env" });

const prisma = new PrismaClient();
const app = express();

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "production";

// Allowed origins - more robust handling
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  "https://bitsa-frontend.vercel.app",
].filter((origin): origin is string => Boolean(origin));

console.log(chalk.blue("🌐 Allowed CORS origins:"), allowedOrigins);
console.log(chalk.blue("📦 Environment:"), NODE_ENV);

// Security + performance middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging
if (NODE_ENV !== "production") {
  app.use(
    morgan("dev", {
      skip: (req) => req.url === "/health",
    })
  );
}

// backend/src/index.ts
// Find the CORS middleware section and replace it with this:

// CORS middleware with improved mobile support
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        console.log(
          chalk.gray("✓ Allowing request with no origin (mobile/app)")
        );
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        console.log(chalk.green(`✓ Allowed CORS from: ${origin}`));
        return callback(null, true);
      }

      // For development: Allow any localhost/127.0.0.1 origin
      if (
        NODE_ENV === "development" &&
        (origin.includes("localhost") || origin.includes("127.0.0.1"))
      ) {
        console.log(chalk.cyan(`✓ Dev mode - allowing: ${origin}`));
        return callback(null, true);
      }

      // Block unauthorized origins
      console.warn(chalk.yellow(`⚠️  Blocked CORS request from: ${origin}`));
      console.warn(
        chalk.yellow(`   Allowed origins: ${allowedOrigins.join(", ")}`)
      );

      const error = new Error(`CORS policy: Origin ${origin} is not allowed`);
      callback(error);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "User-Agent",
    ],
    exposedHeaders: ["Authorization"],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Additional middleware to log all requests for debugging
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === "OPTIONS") {
    console.log(
      chalk.blue("🔍 OPTIONS request from:"),
      req.headers.origin || "no origin"
    );
    console.log(chalk.blue("   Path:"), req.path);
  }
  next();
});

// Cloudinary configuration
CloudinaryUtil.configure({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "✅ BITSA Backend API is running successfully",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    cors: {
      allowedOrigins: allowedOrigins,
    },
  });
});

// Database test endpoint
app.get("/api/db-test", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({ take: 1 });
    res.json({
      success: true,
      message: "Database connection successful",
      userCount: users.length,
    });
  } catch (err: any) {
    console.error(chalk.red("🔥 DB Connection Error:"), err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api", blogRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/student", studentSettingsRoutes);
app.use("/api/admin", adminRoutes);

// File upload error handling
app.use(handleMulterError);

// 404 Handler
app.use((req: Request, res: Response) => {
  console.log(
    chalk.yellow(`❌ 404 - Route not found: ${req.method} ${req.url}`)
  );
  res.status(404).json({
    success: false,
    message: "❌ Route not found",
    path: req.url,
    method: req.method,
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(chalk.red("🔥 Global error:"), err.message);
  console.error(chalk.red("   Path:"), req.url);
  console.error(chalk.red("   Method:"), req.method);

  // Handle CORS errors specifically
  if (err.message && err.message.includes("CORS policy")) {
    return res.status(403).json({
      success: false,
      message: "CORS policy error",
      error: NODE_ENV === "development" ? err.message : "Origin not allowed",
      allowedOrigins: NODE_ENV === "development" ? allowedOrigins : undefined,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    error: NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Start server
const server = http.createServer(app);

// Connect to database
(async () => {
  try {
    await prisma.$connect();
    console.log(chalk.green("✅ Connected to Neon database successfully"));
  } catch (err: any) {
    console.error(chalk.red("❌ Failed to connect to Neon DB:"), err.message);
    process.exit(1);
  }
})();

// Start listening
server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`
${chalk.green.bold("🚀 BITSA Backend Server Started")}
----------------------------------------
🌍 URL: ${baseUrl}
🏥 Health Check: ${baseUrl}/health
🔐 Auth API: ${baseUrl}/api/auth
📝 Blog API: ${baseUrl}/api/blogs
🎉 Events API: ${baseUrl}/api/events
🖼️ Gallery API: ${baseUrl}/api/gallery
🌐 CORS Allowed: ${allowedOrigins.join(", ")}
🧱 Environment: ${NODE_ENV}
☁️ Cloudinary: ${
    process.env.CLOUDINARY_CLOUD_NAME ? "✅ Configured" : "❌ Missing"
  }
----------------------------------------
  `);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log(chalk.yellow("\n👋 Server shutting down gracefully..."));
  await prisma.$disconnect();
  server.close(() => {
    console.log(chalk.green("✅ Server closed"));
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  console.log(
    chalk.yellow("\n👋 SIGTERM received, shutting down gracefully...")
  );
  await prisma.$disconnect();
  server.close(() => {
    console.log(chalk.green("✅ Server closed"));
    process.exit(0);
  });
});

process.on("unhandledRejection", (err: any) => {
  console.error(chalk.red("❌ Unhandled Rejection:"), err);
  console.error(err.stack);
});

process.on("uncaughtException", (err: any) => {
  console.error(chalk.red("❌ Uncaught Exception:"), err);
  console.error(err.stack);
  process.exit(1);
});

export default app;
