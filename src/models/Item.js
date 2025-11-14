const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
   category: { type: String, enum: ['General','Work','Personal','Study','Other'], default: 'General' },
  imageUrl: { type: String },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

module.exports = mongoose.model("Item", itemSchema);
