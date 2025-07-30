const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const transactionsRoutes = require("./routes/transactions");
const darajaRoutes = require("./routes/daraja");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", authRoutes);
app.use("/daraja", darajaRoutes);
app.use("/transactions", transactionsRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;