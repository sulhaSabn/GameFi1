const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: "", maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    dailyPlayLimit: { type: Number, default: 10, min: 0 },
    pointsPerPlay: { type: Number, default: 5, min: 0 },
    maxPointsPerDay: { type: Number, default: 50, min: 0 }
  },
  { timestamps: true }
);

gameSchema.index({ slug: 1 });

module.exports = mongoose.models.Game || mongoose.model("Game", gameSchema);