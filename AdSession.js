const mongoose = require("mongoose");

const adSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "Advertisement", required: true, index: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    pointsEarned: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" }
  },
  { timestamps: true }
);

adSessionSchema.index({ userId: 1, adId: 1, createdAt: -1 });

module.exports = mongoose.models.AdSession || mongoose.model("AdSession", adSessionSchema);
