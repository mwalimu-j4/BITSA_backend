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

// 🧩 Load environment variables
dotenv.config({ path: ".env" });

const app = express();

// ✅ Use Render-assigned PORT (never hardcode)
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const HOST = process.env.HOST || "0.0.0.0";
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://bitsa-frontend.vercel.app";
const NODE_ENV = process.env.NODE_ENV || "production";

// 🛡️ Security + performance middleware
app.use(helmet()); // Sets secure HTTP headers
app.use(compression()); // Gzip responses
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 🪵 Request logging (less noisy in production)
if (NODE_ENV !== "production") {
  app.use(
    morgan("dev", {
      skip: (req) => req.url === "/health",
    })
  );
}

// 🌐 CORS configuration
app.use(
  cors({
    origin: [FRONTEND_URL], // Restrict only to your frontend domain
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ☁️ Configure Cloudinary
CloudinaryUtil.configure({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

// 🏥 Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "✅ BITSA Backend API is running successfully",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// 🚪 API Routes
app.use("/api/auth", authRoutes);
app.use("/api", blogRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/student", studentSettingsRoutes);
app.use("/api/admin", adminRoutes);

// 🧩 File upload error handling
app.use(handleMulterError);

// 🚧 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "❌ Route not found",
  });
});

// 💥 Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(chalk.red("🔥 Global error:"), err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: NODE_ENV === "development" ? err.message : undefined,
  });
});

// 🚀 Start server
const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`
${chalk.green.bold("🚀 BITSA Backend Server Started")}
----------------------------------------
🌍 ${chalk.cyan("URL:")} ${baseUrl}
🏥 ${chalk.cyan("Health Check:")} ${baseUrl}/health
🖼️ ${chalk.cyan("Gallery API:")} ${baseUrl}/api/gallery
🌐 ${chalk.cyan("CORS Allowed:")} ${FRONTEND_URL}
🧱 ${chalk.cyan("Environment:")} ${NODE_ENV}
☁️ ${chalk.cyan("Cloudinary:")} ${
    process.env.CLOUDINARY_CLOUD_NAME ? "✅ Configured" : "❌ Missing"
  }
----------------------------------------
  `);
});

// 🧹 Graceful shutdown
process.on("SIGINT", () => {
  console.log(chalk.yellow("👋 Server shutting down gracefully..."));
  server.close(() => process.exit(0));
});

process.on("unhandledRejection", (err: any) => {
  console.error(chalk.red("Unhandled Rejection:"), err);
});

process.on("uncaughtException", (err: any) => {
  console.error(chalk.red("Uncaught Exception:"), err);
  process.exit(1);
});

export default app;
