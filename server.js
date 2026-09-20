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
const Advertisement = require("./Advertisement");

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

// Serve the frontend from the same origin so the browser only uses relative /api URLs.
app.use(express.static(__dirname, { index: false }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api", apiLimiter);

app.get("/", (req, res) => {
  res.sendFile(require("path").join(__dirname, "BRICS-index.html"));
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
const adsRoutes = require("./ads");
app.use("/api/ads", adsRoutes);

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

    const seedGames = [
      ["local-tap", "ضربه سریع", "در 15 ثانیه تا می‌توانی سریع ضربه بزن.", 1, 15, 15],
      ["local-reaction", "واکنش سریع", "وقتی صفحه سبز شد سریع کلیک کن.", 5, 10, 25],
      ["local-memory", "حافظه کارت‌ها", "جفت کارت‌های مشابه را پیدا کن.", 10, 5, 50],
      ["local-math", "محاسبه سریع", "پاسخ درست را قبل از پایان زمان انتخاب کن.", 10, 5, 50],
      ["local-target", "هدف‌گیری", "در 20 ثانیه بیشترین هدف را بزن.", 5, 5, 50],
      ["local-color", "رنگ سریع", "رنگ درست را از بین گزینه‌ها انتخاب کن.", 10, 5, 50],
      ["local-sequence", "حافظه عددی", "دنباله عددی را حفظ کن و بازسازی کن.", 15, 3, 60],
      ["local-precision", "دقت طلایی", "در زمان محدود هدف‌ها را با دقت بزن.", 5, 5, 50]
    ];
    for (const [slug, name, description, pointsPerPlay, dailyPlayLimit, maxPointsPerDay] of seedGames) {
      await Game.findOneAndUpdate(
        { slug },
        { $setOnInsert: { name, slug, description, isActive: true, pointsPerPlay, dailyPlayLimit, maxPointsPerDay } },
        { upsert: true, new: true }
      );
    }
    if (await Advertisement.countDocuments() === 0) {
      await Advertisement.create({ title: "تبلیغ روزانه", url: "https://example.com", rewardPoints: 25, viewSeconds: 15, dailyLimitPerUser: 1, isActive: true });
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