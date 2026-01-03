// server/routes/projects.js
import express from "express";
import Project from "../models/Projects.js";

const router = express.Router();

// GET /api/projects  -> list all
router.get("/", async (_req, res) => {
  try {
    const projects = await Project.find().sort({ dueDate: 1 });
    res.json(projects);
  } catch (err) {
    console.error("GET /api/projects error:", err);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
});

// GET /api/projects/:id  -> one (by logical id, e.g. PRJ-001)
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findOne({ id: req.params.id });
    if (!project) return res.status(404).json({ message: "Not found" });
    res.json(project);
  } catch (err) {
    console.error("GET /api/projects/:id error:", err);
    res.status(500).json({ message: "Failed to fetch project" });
  }
});

// POST /api/projects  -> create
router.post("/", async (req, res) => {
  try {
    const project = new Project(req.body);
    const saved = await project.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("POST /api/projects error:", err);
    res.status(500).json({ message: "Failed to create project" });
  }
});

// PUT /api/projects/:id  -> update by logical id
router.put("/:id", async (req, res) => {
  try {
    const updated = await Project.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    console.error("PUT /api/projects/:id error:", err);
    res.status(500).json({ message: "Failed to update project" });
  }
});

// DELETE /api/projects/:id
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Project.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/projects/:id error:", err);
    res.status(500).json({ message: "Failed to delete project" });
  }
});

export default router;
