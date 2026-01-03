// scripts/seedUsers.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const users = [
    {
      email: "admin@acta.vc",
      password: "Admin123!",
      name: "Admin",
      role: "admin",
    },
    {
      email: "Jean@acta.vc",
      password: "Jean123!",
      name: "Jean",
      role: "finance",
    },
  ];

  for (const u of users) {
    const existing = await User.findOne({ email: u.email.toLowerCase() });
    if (existing) {
      console.log(`User already exists: ${u.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 10);
    await User.create({
      email: u.email.toLowerCase(),
      passwordHash,
      name: u.name,
      role: u.role,
    });

    console.log(`Created user: ${u.email}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
