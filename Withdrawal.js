const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending"
    },
    adminNote: { type: String, default: "", maxlength: 1000 },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    processedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

module.exports =
  mongoose.models.Withdrawal || mongoose.model("Withdrawal", withdrawalSchema);