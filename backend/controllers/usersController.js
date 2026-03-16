import asyncHandler from "../middlewares/asyncHandler.js";
import User from "../modals/user.js";
import jwt from "jsonwebtoken";
// import passport from "passport";
// import { emailQueue } from "../queues/emailQueue.js";

const generateToken = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const generateRole = (res, role) => {
  res.cookie("role", role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

//@route POST /api/v1/users/login
//@desc Authenticate user
//@access Public

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  //Find the user by email
  let user = await User.findOne({ email });

  if (!user) return res.status(400).json({ message: "Invalid Crendentials" });
  if (!user.status === "active")
    return res.status(400).json({ message: "Restricted User" });
  if (user.authProvider === "google") {
    return res.status(400).json({
      message: "Please login using Google",
    });
  }
  const isMatch = await user.matchPassword(password);
  if (!isMatch)
    return res.status(400).json({ message: "Invalid Crendentials" });

  generateToken(res, user._id);
  generateRole(res, user.role);
  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

//@route POST /api/v1/users/register
//@desc Register a new user
//@access Public

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  //Registration LOgic
  let user = await User.findOne({ email });

  if (user) return res.status(400).json({ message: "User already exists." });

  user = new User({ name, email, password });
  await user.save();
  // Queue welcome email
  //   await emailQueue.add({
  //     to: email,
  //     subject: "Welcome to Rabbit",
  //     html: `<p>Hi ${name}, welcome to Rabbit! Your account has been created successfully.</p>`,
  //   });

  generateToken(res, user._id);
  res.json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

//@route Get /api/v1/users/profile
//@desc Get logged-in user's profile (Protected Route)
//@access Private

const getUserProfile = asyncHandler(async (req, res) => {
  res.json(req.user);
});

//@route POST /api/v1/users/logout
//@desc POST logged-out user
//@access Private

const userLogout = asyncHandler(async (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(0),
  });
  res.cookie("role", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.json({ message: "Logged out" });
});

export { loginUser, registerUser, getUserProfile, userLogout };
