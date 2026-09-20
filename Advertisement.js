const mongoose = require("mongoose");

const advertisementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    url: { type: String, required: true, trim: true, maxlength: 2000 },
    rewardPoints: { type: Number, required: true, min: 0, max: 100000 },
    viewSeconds: { type: Number, default: 15, min: 3, max: 300 },
    dailyLimitPerUser: { type: Number, default: 1, min: 1, max: 20 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Advertisement || mongoose.model("Advertisement", advertisementSchema);
