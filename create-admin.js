require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("./User");

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing");
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    console.log("Admin/user with this email already exists.");
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);

  await User.create({
    username: `admin_${crypto.randomBytes(3).toString("hex")}`,
    email,
    passwordHash,
    role: "admin",
    referralCode: crypto.randomBytes(5).toString("hex").toUpperCase()
  });

  console.log("Admin created successfully.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});