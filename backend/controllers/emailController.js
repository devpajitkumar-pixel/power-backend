import asyncHandler from "../middlewares/asyncHandler.js";
import { transporter } from "../config/email.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//@route POST /api/v1/email/leads
//@desc Email notification for new Leads
//@access Public

const newLeads = asyncHandler(async (req, res) => {
  const { name, email, message } = req.body;

  // Read HTML template
  const templatePath = path.join(__dirname, "../templates", "leads.html");
  let html = fs.readFileSync(templatePath, "utf8");

  // Replace placeholders
  html = html
    .replace("{{name}}", name)
    .replace("{{email}}", email)
    .replace("{{message}}", message);

  await transporter.sendMail({
    from: `"Landing Page" <${process.env.SMTP_USER}>`,
    to: process.env.SMTP_USER,
    subject: `New message from ${name}`,
    html: html,
  });

  res.json({ message: "Email sent successfully" });
});

export { newLeads };
