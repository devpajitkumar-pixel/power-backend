import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER, // your gmail address
    pass: process.env.SMTP_PASS, // app password (NOT real password)
  },
});
