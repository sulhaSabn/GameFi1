const express = require("express");
const mongoose = require("mongoose");
const Withdrawal = require("./Withdrawal");
const Transaction = require("./Transaction");
const User = require("./User");
const { requireAuth, requireAdmin } = require("./auth");

const router = express.Router();

router.post("/", requireAuth, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const amount = Number(req.body.amount);
    const method = String(req.body.method || "USDT").trim().toUpperCase();
    const destination = String(req.body.destination || req.body.address || req.body.walletAddress || "").trim();
    const min = Number(process.env.MIN_WITHDRAWAL || 1);

    if (!Number.isFinite(amount) || amount < min) {
      return res.status(400).json({ success: false, message: `Minimum withdrawal is ${min}` });
    }
    if (!destination) {
      return res.status(400).json({ success: false, message: "Destination wallet is required" });
    }

    let created;
    await session.withTransaction(async () => {
      const user = await User.findOne({ _id: req.user._id }).session(session);
      if (!user || user.points < amount) throw new Error("INSUFFICIENT_POINTS");

      user.points -= amount;
      await user.save({ session });

      const withdrawal = await Withdrawal.create([{
        userId: user._id,
        amount,
        method,
        destination,
        status: "pending"
      }], { session });

      await Transaction.create([{
        userId: user._id,
        type: "withdrawal",
        amount,
        points: amount,
        reference: `WD-${withdrawal[0]._id}`,
        status: "pending"
      }], { session });

      created = withdrawal[0];
    });

    res.status(201).json({ success: true, message: "Withdrawal request created", data: { withdrawal: created } });
  } catch (err) {
    if (err.message === "INSUFFICIENT_POINTS") {
      return res.status(400).json({ success: false, message: "Insufficient points" });
    }
    next(err);
  } finally {
    await session.endSession();
  }
});

router.get("/my", requireAuth, async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { withdrawals } });
  } catch (err) { next(err); }
});

router.get("/admin", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const withdrawals = await Withdrawal.find().populate("userId", "username email").sort({ createdAt: -1 });
    res.json({ success: true, data: { withdrawals } });
  } catch (err) { next(err); }
});

router.patch("/admin/:id", requireAuth, requireAdmin, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const status = String(req.body.status || "");
    if (!["approved", "rejected", "paid"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    let result;
    await session.withTransaction(async () => {
      const withdrawal = await Withdrawal.findById(req.params.id).session(session);
      if (!withdrawal) throw new Error("NOT_FOUND");
      if (withdrawal.status === "paid") throw new Error("ALREADY_PAID");

      withdrawal.status = status;
      withdrawal.adminNote = String(req.body.adminNote || "").slice(0, 1000);
      withdrawal.processedBy = req.user._id;
      withdrawal.processedAt = new Date();
      await withdrawal.save({ session });

      const txStatus = status === "rejected" ? "rejected" : status === "paid" ? "completed" : "pending";
      await Transaction.findOneAndUpdate(
        { reference: `WD-${withdrawal._id}` },
        { $set: { status: txStatus } },
        { session }
      );

      if (status === "rejected") {
        await User.updateOne(
          { _id: withdrawal.userId },
          { $inc: { points: withdrawal.amount } },
          { session }
        );
      }

      if (status === "paid") {
        await User.updateOne(
          { _id: withdrawal.userId },
          { $inc: { totalWithdrawn: withdrawal.amount } },
          { session }
        );
      }

      result = withdrawal;
    });

    res.json({ success: true, message: "Withdrawal updated", data: { withdrawal: result } });
  } catch (err) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ success: false, message: "Withdrawal not found" });
    if (err.message === "ALREADY_PAID") return res.status(409).json({ success: false, message: "Withdrawal already paid" });
    next(err);
  } finally {
    await session.endSession();
  }
});

module.exports = router;