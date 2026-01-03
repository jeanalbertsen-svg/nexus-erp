// server/models/Project.js
import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    id: { type: String }, // UI id (e.g. T-1 or randomId)
    title: { type: String, required: true },
    description: { type: String },
    subTasks: [{ type: String }],
    owner: { type: String },
    startDate: { type: String },  // keep as ISO string
    endDate: { type: String },
    progress: { type: Number, default: 0 },
    done: { type: Boolean, default: false },
  },
  { _id: false } // no separate ObjectId for each task
);

const ProjectSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // PRJ-001 etc
    code: { type: String, required: true },
    name: { type: String, required: true },
    owner: { type: String },
    client: { type: String },
    status: {
      type: String,
      enum: ["planned", "active", "on-hold", "completed", "cancelled"],
      default: "planned",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    startDate: { type: String },
    dueDate: { type: String },
    progress: { type: Number, default: 0 },
    budget: { type: Number, default: 0 },
    budgetUsed: { type: Number, default: 0 },
    tags: [{ type: String }],
    summary: { type: String },
    description: { type: String },
    notes: { type: String },
    tasks: [TaskSchema],
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", ProjectSchema);

export default Project;
