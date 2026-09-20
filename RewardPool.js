const mongoose = require("mongoose");

const rewardPoolSchema = new mongoose.Schema(
  {
    period: { type: String, required: true, unique: true },
    revenue: { type: Number, default: 0, min: 0 },
    expenses: { type: Number, default: 0, min: 0 },
    userRewardBudget: { type: Number, default: 0, min: 0 },
    ownerShare: { type: Number, default: 0, min: 0 },
    reserve: { type: Number, default: 0, min: 0 },
    distributed: { type: Number, default: 0, min: 0 },
    remaining: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.RewardPool || mongoose.model("RewardPool", rewardPoolSchema);