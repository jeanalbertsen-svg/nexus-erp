// server/scripts/drop_gl_unique_index.js
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.collection("glentries"); // adjust if your collection name differs
  const idx = await col.indexes();
  console.log("Existing indexes:", idx);

  // Find and drop a unique index on journalNo if present
  const jn = idx.find(i => i.key && i.key.journalNo === 1 && i.unique);
  if (jn) {
    await col.dropIndex(jn.name);
    console.log("Dropped unique index:", jn.name);
  } else {
    console.log("No unique index on journalNo found.");
  }

  await mongoose.disconnect();
};

run().catch(e => { console.error(e); process.exit(1); });
