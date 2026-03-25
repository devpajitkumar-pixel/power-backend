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
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const generateRole = (res, role) => {
  res.cookie("role", role, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

//@route POST /api/v1/users/login
//@desc Authenticate user
//@access Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  let user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ message: "Invalid Credentials" });
  }

  if (user.status !== "active") {
    return res.status(400).json({ message: "Restricted User" });
  }

  if (user.authProvider === "google") {
    return res.status(400).json({
      message: "Please login using Google",
    });
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return res.status(400).json({ message: "Invalid Credentials" });
  }

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

  let user = await User.findOne({ email });

  if (user) {
    return res.status(400).json({ message: "User already exists." });
  }

  user = new User({ name, email, password });
  await user.save();

  generateToken(res, user._id);
  generateRole(res, user.role);

  res.status(201).json({
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

//@route Get /api/v1/users/auditors
//@desc Get all auditors (Protected Route)
//@access Private
const getAuditors = asyncHandler(async (req, res) => {
  const auditors = await User.find(
    { role: "auditor", status: "active" },
    "_id name email phone status role",
  ).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: auditors.length,
    data: auditors,
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const { name, email, role, password, status } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      res.status(400);
      throw new Error("Email already in use");
    }
  }

  user.name = name ?? user.name;
  user.email = email ?? user.email;
  user.role = role ?? user.role;
  user.status = status ?? user.status;

  if (password && password.trim() !== "") {
    user.password = password;
  }

  const updatedUser = await user.save();

  res.status(200).json({
    success: true,
    data: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
    },
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
});

export {
  loginUser,
  registerUser,
  getUserProfile,
  userLogout,
  getAuditors,
  updateUser,
  deleteUser,
};
