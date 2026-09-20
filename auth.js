const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("./User");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    points: user.points,
    coins: user.coins,
    status: user.status,
    referralCode: user.referralCode,
    totalEarned: user.totalEarned,
    totalWithdrawn: user.totalWithdrawn,
    gamesPlayed: user.gamesPlayed || 0,
    usdValue: Number((Number(user.points || 0) / Number(process.env.POINTS_PER_USD || 1000000)).toFixed(9)),
    pointsPerUsd: Number(process.env.POINTS_PER_USD || 1000000),
    createdAt: user.createdAt
  };
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: "Authentication required" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    if (user.status !== "active") return res.status(403).json({ success: false, message: "Account is not active" });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}

router.post("/register", async (req, res, next) => {
  try {
    let { username, email, password, referralCode } = req.body;
    username = String(username || "").trim();
    email = String(email || "").trim().toLowerCase();
    password = String(password || "");

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ success: false, message: "Username must be 3-30 characters" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) return res.status(409).json({ success: false, message: "Username or email already exists" });

    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: String(referralCode).trim() });
      if (referrer) referredBy = referrer._id;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const generatedReferralCode = crypto.randomBytes(5).toString("hex").toUpperCase();

    const user = await User.create({
      username,
      email,
      passwordHash,
      referredBy,
      referralCode: generatedReferralCode
    });

    const token = signToken(user);
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: { token, user: publicUser(user) }
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });
    if (user.status !== "active") return res.status(403).json({ success: false, message: "Account is not active" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = signToken(user);
    return res.json({
      success: true,
      message: "Login successful",
      data: { token, user: publicUser(user) }
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ success: true, message: "Authenticated user", data: { user: publicUser(req.user) } });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.publicUser = publicUser;