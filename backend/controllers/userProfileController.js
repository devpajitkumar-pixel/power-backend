import asyncHandler from "../middlewares/asyncHandler.js";
import User from "../modals/user.js";
import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

// @route   GET /api/v1/users/profile
// @desc    Get logged in user profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json(user);
});

// @route   PUT /api/v1/users/profile
// @desc    Update logged in user profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const updatedFields = [];

  if (req.body.name && req.body.name !== user.name) {
    user.name = req.body.name;
    updatedFields.push("name");
  }

  if (req.body.email && req.body.email !== user.email) {
    const existingUser = await User.findOne({
      email: req.body.email,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    user.email = req.body.email;
    updatedFields.push("email");
  }

  if (req.body.password) {
    user.password = req.body.password;
    updatedFields.push("password");
  }

  const updatedUser = await user.save();

  if (updatedFields.length > 0) {
    await createRecentActivity({
      actor: req.user,
      action: "updated",
      entity_type: "profile",
      entity_id: updatedUser._id,
      entity_name: updatedUser.name,
      message: buildActivityMessage({
        actorName: req.user?.name || updatedUser.name,
        action: "updated",
        entityLabel: "profile",
        entityName: updatedUser.name,
      }),
      meta: {
        updated_fields: updatedFields,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  }

  return res.status(200).json({
    message: "Profile updated successfully",
    user: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    },
  });
});

export { getUserProfile, updateUserProfile };
