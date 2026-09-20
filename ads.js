const express = require("express");
const mongoose = require("mongoose");
const Advertisement = require("./Advertisement");
const AdSession = require("./AdSession");
const User = require("./User");
const Transaction = require("./Transaction");
const RewardPool = require("./RewardPool");
const { requireAuth, requireAdmin } = require("./auth");

const router = express.Router();
const MIN_AD_SECONDS = Math.max(3, Number(process.env.MIN_AD_SECONDS || 10));
const POINTS_PER_USD = Number(process.env.POINTS_PER_USD || 1000000);

function startOfDay() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function currentPeriod() { return new Date().toISOString().slice(0, 7); }

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const ads = await Advertisement.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).select("title url rewardPoints viewSeconds dailyLimitPerUser");
    res.json({ success: true, data: { ads } });
  } catch (err) { next(err); }
});

router.post("/:id/start", requireAuth, async (req, res, next) => {
  try {
    const ad = await Advertisement.findOne({ _id: req.params.id, isActive: true });
    if (!ad) return res.status(404).json({ success: false, message: "Advertisement not found" });
    const todayCount = await AdSession.countDocuments({ userId: req.user._id, adId: ad._id, createdAt: { $gte: startOfDay() }, status: "verified" });
    if (todayCount >= ad.dailyLimitPerUser) return res.status(429).json({ success: false, message: "این تبلیغ امروز قبلاً دریافت شده است." });
    const pending = await AdSession.findOne({ userId: req.user._id, adId: ad._id, status: "pending", completedAt: null, createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } });
    if (pending) return res.status(409).json({ success: false, message: "یک مشاهده فعال دارید.", data: { sessionId: pending._id, viewSeconds: ad.viewSeconds } });
    const session = await AdSession.create({ userId: req.user._id, adId: ad._id });
    res.status(201).json({ success: true, data: { sessionId: session._id, url: ad.url, viewSeconds: Math.max(MIN_AD_SECONDS, ad.viewSeconds), rewardPoints: ad.rewardPoints } });
  } catch (err) { next(err); }
});

router.post("/:id/complete", requireAuth, async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const ad = await Advertisement.findOne({ _id: req.params.id, isActive: true });
    if (!ad) return res.status(404).json({ success: false, message: "Advertisement not found" });
    const sessionId = String(req.body.sessionId || "").trim();
    if (!mongoose.isValidObjectId(sessionId)) return res.status(400).json({ success: false, message: "Valid sessionId is required" });
    const adSession = await AdSession.findOne({ _id: sessionId, userId: req.user._id, adId: ad._id });
    if (!adSession) return res.status(404).json({ success: false, message: "Ad session not found" });
    if (adSession.completedAt) return res.status(409).json({ success: false, message: "Ad session already completed" });
    const elapsed = Math.floor((Date.now() - adSession.startedAt.getTime()) / 1000);
    const required = Math.max(MIN_AD_SECONDS, ad.viewSeconds);
    if (elapsed < required) return res.status(400).json({ success: false, message: `لطفاً ${required - elapsed} ثانیه دیگر صبر کنید.` });

    const todayCount = await AdSession.countDocuments({ userId: req.user._id, adId: ad._id, createdAt: { $gte: startOfDay() }, status: "verified" });
    if (todayCount >= ad.dailyLimitPerUser) return res.status(429).json({ success: false, message: "سقف روزانه این تبلیغ تکمیل شده است." });

    const pointsEarned = Math.max(0, Math.floor(ad.rewardPoints));
    await mongoSession.withTransaction(async () => {
      const locked = await AdSession.findOneAndUpdate(
        { _id: adSession._id, userId: req.user._id, status: "pending", completedAt: null },
        { $set: { pointsEarned, status: "verified", completedAt: new Date() } },
        { new: true, session: mongoSession }
      );
      if (!locked) throw new Error("AD_SESSION_ALREADY_COMPLETED");
      if (pointsEarned > 0) {
        const pool = await RewardPool.findOne({ period: currentPeriod() }).session(mongoSession);
        if (pool && pool.remaining < pointsEarned) throw new Error("REWARD_POOL_EMPTY");
        await User.updateOne({ _id: req.user._id }, { $inc: { points: pointsEarned, totalEarned: pointsEarned } }, { session: mongoSession });
        if (pool) { pool.distributed += pointsEarned; pool.remaining -= pointsEarned; await pool.save({ session: mongoSession }); }
      }
      await Transaction.create([{
        userId: req.user._id, type: "reward", amount: 0, points: pointsEarned,
        reference: `AD-${adSession._id}`, status: "completed",
        metadata: { adId: ad._id.toString(), elapsedSeconds: elapsed, source: "advertisement", serverAuthoritative: true }
      }], { session: mongoSession });
    });
    res.json({ success: true, message: "پاداش تبلیغ ثبت شد.", data: { pointsEarned, usdValue: pointsEarned / POINTS_PER_USD } });
  } catch (err) {
    if (err.message === "AD_SESSION_ALREADY_COMPLETED") return res.status(409).json({ success: false, message: "این مشاهده قبلاً ثبت شده است." });
    if (err.message === "REWARD_POOL_EMPTY") return res.status(503).json({ success: false, message: "بودجه پاداش فعلاً کافی نیست." });
    next(err);
  } finally { await mongoSession.endSession(); }
});

router.get("/admin/all", requireAuth, requireAdmin, async (req, res, next) => {
  try { res.json({ success: true, data: { ads: await Advertisement.find().sort({ sortOrder: 1, createdAt: -1 }) } }); }
  catch (err) { next(err); }
});

router.post("/admin", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const ad = await Advertisement.create({
      title: String(req.body.title || "").trim(), url: String(req.body.url || "").trim(),
      rewardPoints: Math.max(0, Math.floor(Number(req.body.rewardPoints) || 0)),
      viewSeconds: Math.max(3, Math.floor(Number(req.body.viewSeconds) || 15)),
      dailyLimitPerUser: Math.max(1, Math.floor(Number(req.body.dailyLimitPerUser) || 1)),
      sortOrder: Number(req.body.sortOrder) || 0, isActive: req.body.isActive !== false
    });
    res.status(201).json({ success: true, message: "تبلیغ اضافه شد.", data: { ad } });
  } catch (err) { next(err); }
});

router.patch("/admin/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const updates = {};
    for (const k of ["title", "url", "isActive"]) if (req.body[k] !== undefined) updates[k] = req.body[k];
    for (const k of ["rewardPoints", "viewSeconds", "dailyLimitPerUser", "sortOrder"]) if (req.body[k] !== undefined) updates[k] = Math.max(0, Math.floor(Number(req.body[k]) || 0));
    if (updates.dailyLimitPerUser !== undefined) updates.dailyLimitPerUser = Math.max(1, updates.dailyLimitPerUser);
    if (updates.viewSeconds !== undefined) updates.viewSeconds = Math.max(3, updates.viewSeconds);
    const ad = await Advertisement.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!ad) return res.status(404).json({ success: false, message: "Advertisement not found" });
    res.json({ success: true, message: "تبلیغ به‌روزرسانی شد.", data: { ad } });
  } catch (err) { next(err); }
});

router.delete("/admin/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try { const ad = await Advertisement.findByIdAndDelete(req.params.id); if (!ad) return res.status(404).json({ success: false, message: "Advertisement not found" }); res.json({ success: true, message: "تبلیغ حذف شد." }); }
  catch (err) { next(err); }
});

module.exports = router;
