const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Get all users (admin only)
router.get("/users", auth, admin, async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

// Delete a user
router.delete("/users/:id", auth, admin, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ msg: "User deleted successfully" });
});

// Update user role
router.put("/users/:id/role", auth, admin, async (req, res) => {
  const { role } = req.body;
  if (!["User", "Admin"].includes(role)) {
    return res.status(400).json({ msg: "Invalid role" });
  }

  const updated = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  ).select("-password");

  res.json(updated);
});

// Reset user password to default
router.put("/users/:id/reset-password", auth, admin, async (req, res) => {
  const hashed = await bcrypt.hash("password123", 10);
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { password: hashed },
    { new: true }
  );

  res.json({ msg: "Password reset to 'password123'" });
});

module.exports = router;
