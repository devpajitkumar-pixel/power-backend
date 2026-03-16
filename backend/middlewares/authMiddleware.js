import jwt from "jsonwebtoken";
import User from "../modals/user.js";

//Middleware to protect routes

const protect = async (req, res, next) => {
  const token = req.cookies.jwt;

  if (!token) {
    res.status(401);
    throw new Error("Not authorized");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Token failed");
  }
};

//Middleware to check if the user is an admin

const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Not authorized as an admin." });
  }
};

export { protect, admin };
