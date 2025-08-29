const express = require("express");
const router = express.Router();

// Import your STK push logic here
// Example: const { triggerSTKPush } = require("../controllers/daraja");
const { triggerSTKPush } = require("../controllers/daraja");

// POST /api/qr-pay
router.post("/api/qr-pay", async (req, res) => {
  const { merchantId, amount, phoneNumber, reference, description } = req.body;

  // Basic validation
  if (!merchantId || !amount || !phoneNumber) {
    return res.status(400).json({ error: "Missing required fields: merchantId, amount, phoneNumber" });
  }

  try {
    // Call your STK push logic here
    const result = await triggerSTKPush({
      merchantId,
      amount,
      phoneNumber,
      reference,
      description,
    });

    // You can customize the response as needed
    res.status(200).json({ message: "Payment prompt sent!", result });
  } catch (error) {
    console.error("STK push error:", error);
    res.status(500).json({ error: error.message || "Failed to send payment prompt" });
  }
});

module.exports = router;