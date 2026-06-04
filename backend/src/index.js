import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler.js";
import { generalLimiter } from "./middleware/rateLimiter.js";

// Import routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import roleRoutes from "./routes/role.routes.js";
import divisionRoutes from "./routes/division.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import overtimeRoutes from "./routes/overtime.routes.js";
import overtimeRecapRoutes from "./routes/overtimeRecap.routes.js";
import payslipRoutes from "./routes/payslip.routes.js";
import welcomeEmailRoutes from "./routes/welcomeEmail.routes.js";
import plottingCompanyRoutes from "./routes/plottingCompany.routes.js";
import documentRoutes from "./routes/document.routes.js";
import internalRoutes from "./routes/internal.routes.js";
import offboardingRoutes from "./routes/offboarding.routes.js";
import entityGroupRoutes from "./routes/entityGroup.routes.js";
import policyTemplateRoutes from "./routes/policyTemplate.routes.js";
import entitySubgroupRoutes from "./routes/entitySubgroup.routes.js";

import leaveReminderTestRoutes from "./routes/leaveReminderTest.routes.js";

// Import middleware
import { authenticateToken } from "./middleware/auth.js";

import schedulerService from "./services/scheduler.service.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS Configuration - Production Ready
const allowedOrigins = [
  "http://localhost:5173", // Development
  "http://localhost:3000", // Development
  "https://polyphyodont-dannielle-semiadhesive.ngrok-free.dev", // Development
  "https://rhaya-human-resources-system.pages.dev", // Production
  process.env.FRONTEND_URL, // From Railway env var
  /\.pages\.dev$/, // All Cloudflare Pages subdomains
];

app.set("trust proxy", 1);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);

      // Check if origin is allowed
      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === "string") return allowed === origin;
        if (allowed instanceof RegExp) return allowed.test(origin);
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false, // Needed if embedding external content
    crossOriginResourcePolicy: { policy: "cross-origin" }, // For CORS support
  }),
);

app.use(generalLimiter); // 100 requests per 15 minutes

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    port: PORT,
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "HR System API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth/*",
      users: "/api/users/*",
      divisions: "/api/divisions/*",
      roles: "/api/roles/*",
      overtime: "/api/overtime/*",
      overtimeRecap: "/api/overtime-recap/*",
      payslips: "/api/payslips/*",
      leaves: "/api/leaves/*",
    },
  });
});

// ============================================
// API ROUTES
// ============================================

// Authentication routes (public)
app.use("/api/auth", authRoutes);
app.use("/api/auth", welcomeEmailRoutes);

// Protected routes (require authentication)
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/divisions", divisionRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/overtime-recap", overtimeRecapRoutes);
app.use("/api/payslips", payslipRoutes);
app.use("/api/plotting-companies", plottingCompanyRoutes);
app.use("/api/users/:userId/documents", documentRoutes);
app.use("/api/admin/leave-reminder", leaveReminderTestRoutes);

// Static file serving for uploads (protected)
app.use("/uploads", authenticateToken, express.static("uploads"));

app.use("/internal", internalRoutes);

app.use("/api/offboarding", offboardingRoutes);

app.use("/api/entity-groups", entityGroupRoutes);

app.use("/api/entity-subgroups", entitySubgroupRoutes);

app.use("/api/policy-templates", policyTemplateRoutes);
// ============================================
// ERROR HANDLING
// ============================================

// 404 handler - must be after all routes
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// Global error handler - must be last
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log("HR System API Server Started");
  console.log("=".repeat(50));
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`API Docs: http://localhost:${PORT}/`);
  console.log("=".repeat(50));

  schedulerService.initializeScheduler();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  schedulerService.stopScheduler();
  server.close(() => {
    console.log("✅ HTTP server closed");
  });
});
