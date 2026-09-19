require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./auth");
const usersRoutes = require("./users");
const gamesRoutes = require("./games");
const rewardsRoutes = require("./rewards");
const withdrawalsRoutes = require("./withdrawals");
const adminRoutes = require("./admin");
const Game = require("./Game");

const app = express();
const PORT = Number(process.env.PORT || 3000);

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is missing in .env");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing in .env");
  process.exit(1);
}

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api", apiLimiter);

app.get("/", (req, res) => {
  res.json({ success: true, message: "AfghanEarn Backend Running" });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "AfghanEarn API is running",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/rewards", rewardsRoutes);
app.use("/api/withdrawals", withdrawalsRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: "A unique value already exists" });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: "Validation error", error: err.message });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    const gameCount = await Game.countDocuments();
    if (gameCount === 0) {
      await Game.create({
        name: "BRICS Daily",
        slug: "brics-daily",
        description: "بازی روزانه BRICS با پاداش ثابت و محدودیت روزانه",
        isActive: true,
        dailyPlayLimit: 10,
        pointsPerPlay: 5,
        maxPointsPerDay: 50
      });
      console.log("Default game created");
    }

    app.listen(PORT, () => {
      console.log(`AfghanEarn API running on port ${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

start();