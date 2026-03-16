import asyncHandler from "../middlewares/asyncHandler.js";
import User from "../modals/user.js";

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
  return res.status(201).json({ message: "User Created successfully.", user });
});

//@route PUT /api/admin/users/:id
//@desc Add a new user(Admin only)
//@access Private/Admin

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Update allowed fields only
  if (req.body.name) user.name = req.body.name;
  if (req.body.email) user.email = req.body.email;
  if (req.body.role) user.role = req.body.role;

  const updatedUser = await user.save();

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

  await user.deleteOne();

  return res.json({
    message: "User deleted successfully",
  });
});

export { getUsers, createUser, updateUser, deleteUser };
