const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["reward", "withdrawal", "admin_adjustment", "referral"],
      required: true
    },
    amount: { type: Number, default: 0, min: 0 },
    points: { type: Number, default: 0, min: 0 },
    reference: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "completed", "rejected"],
      default: "completed"
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, createdAt: -1 });

module.exports =
  mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);