const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Game = require("./Game");
const GameSession = require("./GameSession");
const User = require("./User");
const Transaction = require("./Transaction");
const RewardPool = require("./RewardPool");
const { requireAuth } = require("./auth");

const router = express.Router();
const MIN_GAME_SECONDS = Math.max(0, Number(process.env.MIN_GAME_SECONDS || 5));

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
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

    const pending = await GameSession.findOne({
      userId: req.user._id,
      gameId: game._id,
      verificationStatus: "pending",
      completedAt: null,
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
    }).sort({ createdAt: -1 });

    if (pending) {
      return res.status(409).json({
        success: false,
        message: "You already have an active game session",
        data: { sessionId: pending._id, startedAt: pending.startedAt }
      });
    }

    const session = await GameSession.create({
      userId: req.user._id,
      gameId: game._id,
      ipHash: hashIp(req.ip)
    });

    res.status(201).json({
      success: true,
      message: "Game session started",
      data: {
        sessionId: session._id,
        startedAt: session.startedAt,
        minGameSeconds: MIN_GAME_SECONDS,
        pointsPerPlay: game.pointsPerPlay
      }
    });
  } catch (err) { next(err); }
});

router.post("/:id/complete", requireAuth, async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const game = await Game.findOne({ _id: req.params.id, isActive: true });
    if (!game) return res.status(404).json({ success: false, message: "Game not found" });

    const sessionId = String(req.body.sessionId || "").trim();
    if (!mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ success: false, message: "Valid sessionId is required" });
    }

    const gameSession = await GameSession.findOne({
      _id: sessionId,
      userId: req.user._id,
      gameId: game._id
    });

    if (!gameSession) return res.status(404).json({ success: false, message: "Game session not found" });
    if (gameSession.completedAt) return res.status(409).json({ success: false, message: "Session already completed" });

    const elapsedSeconds = Math.floor((Date.now() - gameSession.startedAt.getTime()) / 1000);
    if (elapsedSeconds < MIN_GAME_SECONDS) {
      return res.status(400).json({
        success: false,
        message: `Please play for at least ${MIN_GAME_SECONDS} seconds`,
        data: { remainingSeconds: MIN_GAME_SECONDS - elapsedSeconds }
      });
    }

    const today = startOfDay();
    const alreadyEarned = await GameSession.aggregate([
      { $match: { userId: req.user._id, gameId: game._id, createdAt: { $gte: today }, verificationStatus: "verified" } },
      { $group: { _id: null, points: { $sum: "$pointsEarned" } } }
    ]);
    const earnedToday = alreadyEarned[0]?.points || 0;
    const clientScore = Math.max(0, Math.floor(Number(req.body.score) || 0));
    // Score is stored for records, but reward points are always server-controlled.
    const pointsEarned = Math.max(0, Math.min(game.pointsPerPlay, game.maxPointsPerDay - earnedToday));

    await mongoSession.withTransaction(async () => {
      const locked = await GameSession.findOneAndUpdate(
        { _id: gameSession._id, userId: req.user._id, completedAt: null, verificationStatus: "pending" },
        {
          $set: {
            score: clientScore,
            pointsEarned,
            verificationStatus: "verified",
            completedAt: new Date()
          }
        },
        { new: true, session: mongoSession }
      );

      if (!locked) throw new Error("SESSION_ALREADY_COMPLETED");

      if (pointsEarned > 0) {
        const pool = await RewardPool.findOne({ period: currentPeriod() }).session(mongoSession);
        if (pool && pool.remaining < pointsEarned) throw new Error("REWARD_POOL_EMPTY");

        await User.updateOne(
          { _id: req.user._id },
          { $inc: { points: pointsEarned, totalEarned: pointsEarned, gamesPlayed: 1 } },
          { session: mongoSession }
        );

        if (pool) {
          pool.distributed += pointsEarned;
          pool.remaining -= pointsEarned;
          await pool.save({ session: mongoSession });
        }
      }

      await Transaction.create([{
        userId: req.user._id,
        type: "reward",
        amount: 0,
        points: pointsEarned,
        reference: `GAME-${gameSession._id}`,
        status: "completed",
        metadata: {
          gameId: game._id.toString(),
          elapsedSeconds,
          serverAuthoritative: true
        }
      }], { session: mongoSession });
    });

    res.json({
      success: true,
      message: pointsEarned > 0 ? "Game completed" : "Daily reward limit reached",
      data: { pointsEarned, elapsedSeconds }
    });
  } catch (err) {
    if (err.message === "SESSION_ALREADY_COMPLETED") {
      return res.status(409).json({ success: false, message: "Session already completed" });
    }
    if (err.message === "REWARD_POOL_EMPTY") {
      return res.status(503).json({ success: false, message: "Reward pool is not sufficient for this reward" });
    }
    next(err);
  } finally {
    await mongoSession.endSession();
  }
});

module.exports = router;
