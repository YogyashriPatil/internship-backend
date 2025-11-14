const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const admin = require("../middleware/adminMiddleware");
const Item = require("../models/Item");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

// multer storage to backend/uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', '..', 'uploads')); // ../uploads
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(12).toString("hex") + ext;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });


// CREATE item
router.post("/", auth, upload.single("image"), async (req, res) => {
  try {
    const { title, description, category } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const item = await Item.create({
      title,
      description,
      category: category || 'General',
      imageUrl,
      ownerId: req.user.id,
    });

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});
// READ items (User → own items, Admin → all items)
router.get("/", auth, async (req, res) => {
  try {
    const q = req.query.search || "";
    const category = req.query.category;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 8, 50);
    const skip = (page - 1) * limit;

    const baseFilter = { title: { $regex: q, $options: "i" } };

    if (category && category !== "All") baseFilter.category = category;

    const filter = req.user.role === "Admin"
      ? baseFilter
      : { ...baseFilter, ownerId: req.user.id };

    const [items, total] = await Promise.all([
      Item.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Item.countDocuments(filter)
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/:id", auth, async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) return res.status(404).json({ msg: "Item not found" });
  // allow only owner or admin
  if (item.ownerId.toString() !== req.user.id && req.user.role !== "Admin") {
    return res.status(403).json({ msg: "Not allowed" });
  }
  res.json(item);
});

// UPDATE item (only owner or admin)
router.put("/:id", auth, upload.single("image"), async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: "Item not found" });

    if (item.ownerId.toString() !== req.user.id && req.user.role !== "Admin") {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const { title, description, category } = req.body;
    if (title) item.title = title;
    if (description) item.description = description;
    if (category) item.category = category;
    if (req.file) item.imageUrl = `/uploads/${req.file.filename}`;

    await item.save();
        res.json(item);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Server error" });
    }
});

// DELETE item (owner or admin)
router.delete("/:id", auth, async (req, res) => {
  const item = await Item.findById(req.params.id);

  if (!item) return res.status(404).json({ msg: "Item not found" });

  if (item.ownerId.toString() !== req.user.id && req.user.role !== "Admin") {
    return res.status(403).json({ msg: "Not allowed" });
  }

  await Item.findByIdAndDelete(req.params.id);
  res.json({ msg: "Item deleted successfully" });
});

router.get("/stats/summary", auth, async (req, res) => {
  try {
    // categories counts (admin: all, user: only own)
    const matchAll = req.user.role === "Admin" ? {} : { ownerId: req.user.id };

    const agg = await Item.aggregate([
      { $match: matchAll },
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);

    // transform to object
    const byCategory = {};
    agg.forEach(a => byCategory[a._id] = a.count);

     const total = await Item.countDocuments(matchAll);

    res.json({ byCategory, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});
module.exports = router;
