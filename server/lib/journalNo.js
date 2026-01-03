import Counter from "../models/Counter.js";
export async function nextJournalNo() {
  const y = new Date().getFullYear();
  const key = `journal:${y}`;
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  const n = String(doc.seq).padStart(5, "0");
  return `J-${y}-${n}`;
}
