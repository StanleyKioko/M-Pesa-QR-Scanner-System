require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Import routes
const authRoutes = require('./routes/auth');
const darajaRoutes = require('./routes/daraja');
const transactionRoutes = require('./routes/transactions');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', authRoutes);          // Authentication routes
app.use('/daraja', darajaRoutes);      // M-Pesa routes  
app.use('/transactions', transactionRoutes); // Transaction routes
app.use('/api', darajaRoutes);         // Alternative API endpoint

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'M-Pesa QR Backend API' });
});

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