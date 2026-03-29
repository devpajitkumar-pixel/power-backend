import asyncHandler from "../middlewares/asyncHandler.js";
import User from "../modals/user.js";
import { createRecentActivity } from "../helpers/createRecentActivity.js";
import { buildActivityMessage } from "../helpers/buildActivityMessage.js";

//@route GET /api/admin/users
//@desc Get all users(Admin only)
//@access Private/Admin

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  return res.json(users);
});

//@route POST /api/admin/users
//@desc Add a new user(Admin only)
//@access Private/Admin

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  let user = await User.findOne({ email });
  if (user) {
    return res.status(400).json({ message: "User already exists." });
  }

  user = new User({
    name,
    email,
    password,
    role: role || "caller",
  });

  await user.save();

  await createRecentActivity({
    actor: req.user,
    action: "created",
    entity_type: "user",
    entity_id: user._id,
    entity_name: user.name,
    message: buildActivityMessage({
      actorName: req.user?.name || "Admin",
      action: "created",
      entityLabel: "user",
      entityName: user.name,
    }),
    meta: {
      email: user.email,
      role: user.role,
    },
  });

  return res.status(201).json({
    message: "User Created successfully.",
    user,
  });
});

//@route PUT /api/admin/users/:id
//@desc Add a new user(Admin only)
//@access Private/Admin

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const updatedFields = [];

  if (req.body.name && req.body.name !== user.name) {
    user.name = req.body.name;
    updatedFields.push("name");
  }

  if (req.body.email && req.body.email !== user.email) {
    user.email = req.body.email;
    updatedFields.push("email");
  }

  if (req.body.role && req.body.role !== user.role) {
    user.role = req.body.role;
    updatedFields.push("role");
  }

  const updatedUser = await user.save();

  await createRecentActivity({
    actor: req.user,
    action: "updated",
    entity_type: "user",
    entity_id: updatedUser._id,
    entity_name: updatedUser.name,
    message: buildActivityMessage({
      actorName: req.user?.name || "Admin",
      action: "updated",
      entityLabel: "user",
      entityName: updatedUser.name,
    }),
    meta: {
      updated_fields: updatedFields,
      email: updatedUser.email,
      role: updatedUser.role,
    },
  });

  return res.status(200).json({
    message: "User updated successfully",
    user: updatedUser,
  });
});

//@route DELETE /api/admin/users/:id
//@desc Delete a user(Admin only)
//@access Private/Admin

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const userName = user.name;
  const userEmail = user.email;
  const userRole = user.role;

  await user.deleteOne();

  await createRecentActivity({
    actor: req.user,
    action: "deleted",
    entity_type: "user",
    entity_id: user._id,
    entity_name: userName,
    message: buildActivityMessage({
      actorName: req.user?.name || "Admin",
      action: "deleted",
      entityLabel: "user",
      entityName: userName,
    }),
    meta: {
      email: userEmail,
      role: userRole,
    },
  });

  return res.json({
    message: "User deleted successfully",
  });
});

export { getUsers, createUser, updateUser, deleteUser };
