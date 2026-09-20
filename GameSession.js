const mongoose = require("mongoose");

const gameSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true, index: true },
    score: { type: Number, default: 0, min: 0 },
    pointsEarned: { type: Number, default: 0, min: 0 },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending"
    },
    ipHash: { type: String, default: "" },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

gameSessionSchema.index({ userId: 1, createdAt: -1 });

module.exports =
  mongoose.models.GameSession || mongoose.model("GameSession", gameSessionSchema);