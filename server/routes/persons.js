// server/routes/persons.js
import express from "express";
import Person, { VALID_PERSON_ROLES } from "../models/Person.js";

const router = express.Router();

/**
 * GET /api/persons?q=alice
 * Returns active persons (optionally filtered by name substring).
 */
router.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const filter = { isActive: true };
    if (q) {
      filter.nameLower = { $regex: q.toLowerCase(), $options: "i" };
    }
    const persons = await Person.find(filter).sort({ nameLower: 1 }).lean();
    res.json(persons.map((p) => ({ id: p._id, name: p.name, roles: p.roles })));
  } catch (err) {
    console.error("GET /api/persons failed:", err);
    res.status(500).json({ error: "Failed to load persons" });
  }
});

/**
 * POST /api/persons
 * Body: { name: string, roles?: string[] }
 */
router.post("/", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    let roles = Array.isArray(req.body?.roles) ? req.body.roles : [];
    roles = roles.filter((r) => VALID_PERSON_ROLES.includes(r));

    if (!name) return res.status(400).json({ error: "Name is required" });

    const created = await Person.create({ name, roles });
    res.status(201).json({ id: created._id, name: created.name, roles: created.roles });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "A person with this name already exists" });
    }
    console.error("POST /api/persons failed:", err);
    res.status(500).json({ error: "Failed to create person" });
  }
});

/**
 * PUT /api/persons/:id
 * Body: { name?: string, roles?: string[], isActive?: boolean }
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patch = {};
    if (typeof req.body?.name === "string") {
      patch.name = req.body.name.trim();
      patch.nameLower = patch.name.toLowerCase();
    }
    if (Array.isArray(req.body?.roles)) {
      patch.roles = [...new Set(req.body.roles.filter((r) => VALID_PERSON_ROLES.includes(r)))];
    }
    if (typeof req.body?.isActive === "boolean") patch.isActive = req.body.isActive;

    const updated = await Person.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ id: updated._id, name: updated.name, roles: updated.roles, isActive: updated.isActive });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "A person with this name already exists" });
    }
    console.error("PUT /api/persons/:id failed:", err);
    res.status(500).json({ error: "Failed to update person" });
  }
});

/**
 * DELETE /api/persons/:id
 * Hard delete. If you prefer soft delete, switch to isActive=false.
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await Person.deleteOne({ _id: id });
    if (r.deletedCount === 0) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  } catch (err) {
    console.error("DELETE /api/persons/:id failed:", err);
    res.status(500).json({ error: "Failed to delete person" });
  }
});

export default router;
