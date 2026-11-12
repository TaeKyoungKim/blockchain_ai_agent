import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { initDatabase } from "./db.js";
import { initWeb3 } from "./web3.js";
import { contractsRouter } from "./routes/contracts.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "real-estate-backend",
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use("/api/contracts", contractsRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Backend Error]", err);
  res.status(err.status || 500).json({
    success: false,
    errorCode: err.code || "INTERNAL_SERVER_ERROR",
    message: err.message || "An unexpected error occurred"
  });
});

// Initialize systems and start server
async function startServer() {
  await initDatabase();
  initWeb3();

  app.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`[Backend Server] Running on http://127.0.0.1:${config.port}`);
    console.log(`[Backend Server] Mode: 100% Pure JavaScript (ESM)`);
    console.log(`[Backend Server] DB: SQLite3 (${config.databasePath})`);
    console.log(`====================================================`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
