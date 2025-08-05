// API Configuration - Support both local and ngrok
const isDevelopment = process.env.NODE_ENV === 'development';
const useNgrok = process.env.REACT_APP_USE_NGROK === 'true';

export const API_BASE_URL = useNgrok 
  ? process.env.REACT_APP_NGROK_URL || 'https://333323a0a07c.ngrok-free.app'
  : process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

// Payment Status Constants
export const STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  ERROR: 'error'
};

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup'
  },
  // M-Pesa/Daraja endpoints
  MPESA: {
    CUSTOMER_PAYMENT: '/daraja/customer-payment',
    MERCHANT_PAYMENT: '/daraja/scan-qr',
    STK_PUSH: '/daraja/scan-qr',
    TRIGGER_STK: '/api/trigger-stk-push',
    CALLBACK: '/daraja/stk-callback'
  },
  TRANSACTIONS: {
    LIST: '/transactions',
    CREATE: '/transactions',
    GET_BY_ID: '/transactions/:id',
    GET_ALL: '/transactions'
  },
  HEALTH: {
    CHECK: '/daraja/health',
    TEST_TOKEN: '/daraja/test-token'
  }
};

// M-Pesa Configuration
export const MPESA_CONFIG = {
  TEST_PHONE: '254708374149',
  SANDBOX_SHORTCODE: '174379',
  PRODUCTION_BASE_URL: 'https://api.safaricom.co.ke',
  SANDBOX_BASE_URL: 'https://sandbox.safaricom.co.ke'
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timeout. Please try again.',
  INVALID_PHONE: 'Please enter a valid phone number in format 254XXXXXXXXX',
  INVALID_AMOUNT: 'Please enter a valid amount greater than 0',
  INVALID_QR: 'Invalid QR code format. Please scan a valid payment QR code.',
  QR_SCAN_FAILED: 'Failed to scan QR code. Please try again.',
  PAYMENT_FAILED: 'Payment initiation failed. Please try again.',
  AUTH_REQUIRED: 'Authentication required. Please login.',
  MERCHANT_NOT_FOUND: 'Merchant not found. Please register first.',
  SANDBOX_PHONE_ONLY: 'Sandbox only works with test number 254708374149'
};

// UI Configuration
export const UI_CONFIG = {
  POLLING_INTERVAL: 5000, // 5 seconds
  MAX_POLL_ATTEMPTS: 12,  // 1 minute total (5s * 12)
  PAYMENT_TIMEOUT: 60000, // 60 seconds
};

// User Roles
export const USER_ROLES = {
  CUSTOMER: 'customer',
  MERCHANT: 'merchant'
};