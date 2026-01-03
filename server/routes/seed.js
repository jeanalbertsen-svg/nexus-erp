// routes/seed.js (server)
import express from "express";
const router = express.Router();

// replace with your DB insert function
async function createDoc(doc) {
  // ...insert into DB...
  return doc; // return the inserted doc
}

router.post("/api/bilags/seed-demo", async (req, res) => {
  const doc = await createDoc({
    type: "invoice",
    status: "READY",
    createdAt: new Date(),
    source: { subject: "Sales INV-TEST-0001.pdf", files: [] },
    extracted: {
      supplier: { name: "Demo Supplier" },
      numbers: { invoiceNo: "INV-TEST-0001" },
      totals: { totalInc: 542.42, currency: "DKK" },
      lines: [{ desc: "Widgets", category: "inventory", qty: 1, uom: "pcs", unitPrice: 542.42, lineTotal: 542.42 }]
    }
  });
  res.json({ ok: true, item: doc });
});

export default router;
