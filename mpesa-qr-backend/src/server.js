require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

// Import routes
const authRoutes = require('./routes/auth');
const darajaRoutes = require('./routes/daraja');
const transactionRoutes = require('./routes/transactions');
const qrPayRouter = require('./routes/qrPay');
app.use(qrPayRouter);

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], // Add your frontend URLs
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

// Routes - Fix the route mounting to include /api prefix
app.use('/api/auth', authRoutes);          // Authentication routes
app.use('/api/daraja', darajaRoutes);      // M-Pesa routes  
app.use('/api/transactions', transactionRoutes); // Transaction routes

// Legacy routes for backwards compatibility
app.use('/auth', authRoutes);
app.use('/daraja', darajaRoutes);
app.use('/transactions', transactionRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'M-Pesa QR Backend API',
    timestamp: new Date().toISOString(),
    routes: {
      auth: '/api/auth',
      daraja: '/api/daraja',
      transactions: '/api/transactions'
    }
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    routes: {
      auth: '/api/auth',
      daraja: '/api/daraja',
      transactions: '/api/transactions'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ 
    error: "Something went wrong!",
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler - Fixed for Express 5 compatibility
app.use((req, res) => {
  console.log('404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth routes: http://localhost:${PORT}/api/auth`);
  console.log(`💰 M-Pesa routes: http://localhost:${PORT}/api/daraja`);
  console.log(`📊 Transaction routes: http://localhost:${PORT}/api/transactions`);
});

module.exports = app;