// server/models/Menu.js
const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    path: { type: String, required: true },
    icon: { type: String },
    badgeKey: { type: String },
    children: [
      {
        key: String,
        label: String,
        path: String,
        icon: String,
        badgeKey: String,
      },
    ],
  },
  { _id: false }
);

const SectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    icon: { type: String },
    path: { type: String, required: true },
    items: [MenuItemSchema],
  },
  { _id: false }
);

const MenuSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, index: true },
    sections: [SectionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Menu', MenuSchema);
