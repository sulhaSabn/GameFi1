const express = require("express");
const RewardPool = require("./RewardPool");
const Transaction = require("./Transaction");
const User = require("./User");
const { requireAuth, requireAdmin } = require("./auth");

const router = express.Router();

router.get("/pool", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const pool = await RewardPool.findOne().sort({ createdAt: -1 });
    res.json({ success: true, data: { pool } });
  } catch (err) { next(err); }
});

router.post("/pool", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const revenue = Math.max(0, Number(req.body.revenue) || 0);
    const expenses = Math.max(0, Number(req.body.expenses) || 0);
    const userSharePercent = Math.max(0, Math.min(100, Number(req.body.userSharePercent ?? 40)));
    const ownerSharePercent = Math.max(0, Math.min(100, Number(req.body.ownerSharePercent ?? 40)));

    const distributable = Math.max(0, revenue - expenses);
    const userRewardBudget = Math.floor(distributable * userSharePercent / 100 * 100) / 100;
    const ownerShare = Math.floor(distributable * ownerSharePercent / 100 * 100) / 100;
    const reserve = Math.max(0, distributable - userRewardBudget - ownerShare);
    const period = String(req.body.period || new Date().toISOString().slice(0, 7));

    const pool = await RewardPool.findOneAndUpdate(
      { period },
      {
        $set: {
          revenue,
          expenses,
          userRewardBudget,
          ownerShare,
          reserve,
          distributed: 0,
          remaining: userRewardBudget
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: "Reward pool saved", data: { pool } });
  } catch (err) { next(err); }
});

router.get("/my", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      data: {
        points: user.points,
        totalEarned: user.totalEarned
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;