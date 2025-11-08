import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import chalk from "chalk";

import authRoutes from "./routes/auth.routes"; // Placeholder, assuming this exists
import blogRoutes from "./routes/blog.routes";
import eventRoutes from "./routes/event.routes";

// 🧩 Load environment variables early
dotenv.config({ path: ".env" });

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || "0.0.0.0";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// 🧩 Middleware setup
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🧾 Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(
    `${chalk.gray(new Date().toISOString())} - ${chalk.cyan(req.method)} ${
      req.path
    }`
  );
  next();
});

// 🏥 Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "✅ BITSA Backend API is running successfully",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// 🚪 API Routes
app.use("/api/auth", authRoutes);
app.use("/api", blogRoutes);
app.use("/api/events", eventRoutes);

// 🚧 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "❌ Route not found",
  });
});

// 💥 Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(chalk.red("🔥 Global error:"), err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 🚀 Create HTTP server
const server = http.createServer(app);

// 🎯 Start the server
server.listen(PORT, HOST, () => {
  const baseUrl = `http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`;
  console.log(`
${chalk.green.bold("🚀 BITSA Backend Server Started")}
----------------------------------------
🌍 ${chalk.cyan("URL:")} ${baseUrl}
🏥 ${chalk.cyan("Health Check:")} ${baseUrl}/health
🌐 ${chalk.cyan("Frontend CORS:")} ${FRONTEND_URL}
🧱 ${chalk.cyan("Environment:")} ${process.env.NODE_ENV || "development"}
----------------------------------------
  `);
});

// 🧹 Graceful shutdown
process.on("SIGINT", () => {
  console.log(chalk.yellow("👋 Server shutting down gracefully..."));
  server.close(() => process.exit(0));
});

export default app;
