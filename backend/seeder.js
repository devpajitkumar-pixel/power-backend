import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

import User from "./modals/user.js";
import PresenceLog from "./modals/presenceLog.js";

dotenv.config();

//Function to seed data

const seedData = async () => {
  try {
    //Clear existing data
    await connectDB();

    await PresenceLog.deleteMany();
    await User.deleteMany();

    // Create default Admin User

    const createdUser = await User.create([
      {
        name: "Admin",
        email: "admin@example.com",
        password: "123456",
        role: "admin",
      },
      {
        name: "Auditor",
        email: "auditor@example.com",
        password: "123456",
        role: "auditor",
      },
    ]);

    process.exit();
  } catch (error) {
    console.error("Error seeding the data", error);
    process.exit(1);
  }
};

seedData();
