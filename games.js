const express = require("express");
const crypto = require("crypto");
const Game = require("./Game");
const GameSession = require("./GameSession");
const User = require("./User");
const Transaction = require("./Transaction");
const { requireAuth } = require("./auth");

const router = express.Router();

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(`${ip || ""}:${process.env.JWT_SECRET}`).digest("hex");
}

router.get("/", async (req, res, next) => {
  try {
    const games = await Game.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: { games } });
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const game = await Game.findOne({ _id: req.params.id, isActive: true });
    if (!game) return res.status(404).json({ success: false, message: "Game not found" });
    res.json({ success: true, data: { game } });
  } catch (err) { next(err); }
});

router.post("/:id/start", requireAuth, async (req, res, next) => {
  try {
    const game = await Game.findOne({ _id: req.params.id, isActive: true });
    if (!game) return res.status(404).json({ success: false, message: "Game not found" });

    const todayCount = await GameSession.countDocuments({
      userId: req.user._id,
      gameId: game._id,
      createdAt: { $gte: startOfDay() }
    });

    if (todayCount >= game.dailyPlayLimit) {
      return res.status(429).json({ success: false, message: "Daily play limit reached" });
    }

    const session = await GameSession.create({
      userId: req.user._id,
      gameId: game._id,
      ipHash: hashIp(req.ip)
    });

    res.status(201).json({
      success: true,
      message: "Game session started",
      data: { sessionId: session._id, startedAt: session.startedAt }
    });
  } catch (err) { next(err); }
});

router.post("/:id/complete", requireAuth, async (req, res, next) => {
  const mongoSession = await User.startSession();
  try {
    const game = await Game.findOne({ _id: req.params.id, isActive: true });
    if (!game) return res.status(404).json({ success: false, message: "Game not found" });

    const sessionId = req.body.sessionId;
    if (!sessionId) return res.status(400).json({ success: false, message: "sessionId is required" });

    const gameSession = await GameSession.findOne({
      _id: sessionId,
      userId: req.user._id,
      gameId: game._id
    });

    if (!gameSession) return res.status(404).json({ success: false, message: "Game session not found" });
    if (gameSession.completedAt) return res.status(409).json({ success: false, message: "Session already completed" });

    const score = Math.max(0, Math.min(Number(req.body.score) || 0, 100000000));
    const today = startOfDay();

    const alreadyEarned = await GameSession.aggregate([
      { $match: { userId: req.user._id, gameId: game._id, createdAt: { $gte: today }, verificationStatus: "verified" } },
      { $group: { _id: null, points: { $sum: "$pointsEarned" } } }
    ]);
    const earnedToday = alreadyEarned[0]?.points || 0;
    const pointsEarned = Math.max(0, Math.min(game.pointsPerPlay, game.maxPointsPerDay - earnedToday));

    await mongoSession.withTransaction(async () => {
      await GameSession.updateOne(
        { _id: gameSession._id, completedAt: null },
        {
          $set: {
            score,
            pointsEarned,
            verificationStatus: "verified",
            completedAt: new Date()
          }
        },
        { session: mongoSession }
      );

      await User.updateOne(
        { _id: req.user._id },
        { $inc: { points: pointsEarned, totalEarned: pointsEarned } },
        { session: mongoSession }
      );

      await Transaction.create([{
        userId: req.user._id,
        type: "reward",
        amount: 0,
        points: pointsEarned,
        reference: `GAME-${gameSession._id}`,
        status: "completed",
        metadata: { gameId: game._id.toString(), score }
      }], { session: mongoSession });
    });

    res.json({ success: true, message: "Game completed", data: { score, pointsEarned } });
  } catch (err) {
    next(err);
  } finally {
    await mongoSession.endSession();
  }
});

module.exports = router;