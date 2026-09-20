const express = require("express");
const User = require("./User");
const Transaction = require("./Transaction");
const { requireAuth } = require("./auth");

const router = express.Router();

router.get("/profile", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      data: {
        user: {
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
          gamesPlayed: user.gamesPlayed || 0
        }
      }
    });
  } catch (err) { next(err); }
});

router.patch("/profile", requireAuth, async (req, res, next) => {
  try {
    const allowed = ["username"];
    const updates = {};
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = String(req.body[key]).trim();

    if (updates.username && (updates.username.length < 3 || updates.username.length > 30)) {
      return res.status(400).json({ success: false, message: "Invalid username" });
    }

    if (updates.username) {
      const exists = await User.findOne({ username: updates.username, _id: { $ne: req.user._id } });
      if (exists) return res.status(409).json({ success: false, message: "Username already exists" });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ success: true, message: "Profile updated", data: { username: user.username } });
  } catch (err) { next(err); }
});

router.get("/transactions", requireAuth, async (req, res, next) => {
  try {
    const items = await Transaction.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: { transactions: items } });
  } catch (err) { next(err); }
});

router.get("/stats", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const transactionCount = await Transaction.countDocuments({ userId: req.user._id });
    res.json({
      success: true,
      data: {
        points: user.points,
        coins: user.coins,
        totalEarned: user.totalEarned,
        totalWithdrawn: user.totalWithdrawn,
        transactionCount
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;