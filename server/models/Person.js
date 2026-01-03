// server/models/Person.js
import mongoose from "mongoose";

const VALID_ROLES = ["prepare", "approve", "post"];

const PersonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    // store a lowercase copy for fast case-insensitive search
    nameLower: { type: String, required: true, lowercase: true, index: true },
    roles: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.every((r) => VALID_ROLES.includes(r)),
        message: `Invalid role; allowed: ${VALID_ROLES.join(", ")}`,
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PersonSchema.pre("validate", function (next) {
  if (typeof this.name === "string") this.nameLower = this.name.toLowerCase();
  if (Array.isArray(this.roles)) {
    this.roles = [...new Set(this.roles)]; // dedupe
  }
  next();
});

export default mongoose.model("Person", PersonSchema);
export const VALID_PERSON_ROLES = ["prepare", "approve", "post"];
