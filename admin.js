const express = require("express");
const User = require("./User");
const Game = require("./Game");
const Transaction = require("./Transaction");
const Withdrawal = require("./Withdrawal");
const RewardPool = require("./RewardPool");
const { requireAuth, requireAdmin } = require("./auth");

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/dashboard", async (req, res, next) => {
  try {
    const [users, activeUsers, games, activeGames, pendingWithdrawals, paidWithdrawals, latestPool] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "active" }),
      Game.countDocuments(),
      Game.countDocuments({ isActive: true }),
      Withdrawal.countDocuments({ status: "pending" }),
      Withdrawal.countDocuments({ status: "paid" }),
      RewardPool.findOne().sort({ createdAt: -1 })
    ]);

    const totals = await Transaction.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: "$type", amount: { $sum: "$amount" }, points: { $sum: "$points" } } }
    ]);

    res.json({
      success: true,
      data: {
        users, activeUsers, games, activeGames, pendingWithdrawals, paidWithdrawals,
        latestPool, transactionTotals: totals
      }
    });
  } catch (err) { next(err); }
});

router.get("/users", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || "").trim();
    const query = search ? {
      $or: [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ]
    } : {};
    const [items, total] = await Promise.all([
      User.find(query).select("-passwordHash").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(query)
    ]);
    res.json({ success: true, data: { users: items, page, limit, total } });
  } catch (err) { next(err); }
});

router.get("/users/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
});

router.patch("/users/:id/status", async (req, res, next) => {
  try {
    const status = String(req.body.status || "");
    if (!["active", "suspended", "banned"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select("-passwordHash");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, message: "User status updated", data: { user } });
  } catch (err) { next(err); }
});

router.get("/games", async (req, res, next) => {
  try {
    res.json({ success: true, data: { games: await Game.find().sort({ createdAt: -1 }) } });
  } catch (err) { next(err); }
});

router.post("/games", async (req, res, next) => {
  try {
    const game = await Game.create({
      name: String(req.body.name || "").trim(),
      slug: String(req.body.slug || "").trim().toLowerCase(),
      description: String(req.body.description || ""),
      isActive: req.body.isActive !== false,
      dailyPlayLimit: Number(req.body.dailyPlayLimit ?? 10),
      pointsPerPlay: Number(req.body.pointsPerPlay ?? 5),
      maxPointsPerDay: Number(req.body.maxPointsPerDay ?? 50)
    });
    res.status(201).json({ success: true, message: "Game created", data: { game } });
  } catch (err) { next(err); }
});

router.patch("/games/:id", async (req, res, next) => {
  try {
    const allowed = ["name", "description", "isActive", "dailyPlayLimit", "pointsPerPlay", "maxPointsPerDay"];
    const updates = {};
    for (const key of allowed) if (req.body[key] !== undefined) updates[key] = req.body[key];
    const game = await Game.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!game) return res.status(404).json({ success: false, message: "Game not found" });
    res.json({ success: true, message: "Game updated", data: { game } });
  } catch (err) { next(err); }
});

router.delete("/games/:id", async (req, res, next) => {
  try {
    const game = await Game.findByIdAndDelete(req.params.id);
    if (!game) return res.status(404).json({ success: false, message: "Game not found" });
    res.json({ success: true, message: "Game deleted" });
  } catch (err) { next(err); }
});

router.get("/withdrawals", async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find().populate("userId", "username email").sort({ createdAt: -1 });
    res.json({ success: true, data: { withdrawals } });
  } catch (err) { next(err); }
});

router.get("/transactions", async (req, res, next) => {
  try {
    const transactions = await Transaction.find().populate("userId", "username email").sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, data: { transactions } });
  } catch (err) { next(err); }
});

router.get("/reward-pool", async (req, res, next) => {
  try {
    const pools = await RewardPool.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: { pools } });
  } catch (err) { next(err); }
});

router.get("/reports", async (req, res, next) => {
  try {
    const [users, transactions, withdrawals] = await Promise.all([
      User.countDocuments(),
      Transaction.countDocuments(),
      Withdrawal.countDocuments()
    ]);
    res.json({ success: true, data: { users, transactions, withdrawals } });
  } catch (err) { next(err); }
});

module.exports = router;