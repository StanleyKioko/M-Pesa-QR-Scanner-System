// API Configuration
export const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  // Authentication endpoints
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    LOGOUT: '/auth/logout'
  },
  
  // Transaction endpoints
  TRANSACTIONS: {
    CREATE: '/transactions',
    GET_ALL: '/transactions',
    GET_BY_ID: '/transactions'
  },
  
  // M-Pesa/Daraja endpoints
  MPESA: {
    STK_PUSH: '/daraja/scan-qr',
    TRIGGER_STK: '/api/trigger-stk-push',
    CALLBACK: '/daraja/stk-callback'
  }
};

// Payment Status Constants
export const STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  ERROR: 'error',
  CANCELLED: 'cancelled'
};

// M-Pesa Configuration
export const MPESA_CONFIG = {
  TEST_PHONE: '254708374149',
  CURRENCY: 'KES',
  COUNTRY_CODE: '254',
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 70000
};

// App Configuration
export const APP_CONFIG = {
  APP_NAME: 'M-Pesa QR Scanner',
  VERSION: '1.0.0',
  TRANSACTION_REFRESH_INTERVAL: 30000, // 30 seconds
  STATUS_CHECK_INTERVAL: 5000, // 5 seconds
  PAYMENT_TIMEOUT: 300000 // 5 minutes
};

// Badge Variants for Status
export const STATUS_VARIANTS = {
  [STATUS.SUCCESS]: 'success',
  [STATUS.PENDING]: 'warning',
  [STATUS.FAILED]: 'error',
  [STATUS.ERROR]: 'error',
  [STATUS.CANCELLED]: 'secondary'
};

// Status Labels
export const STATUS_LABELS = {
  [STATUS.SUCCESS]: 'Completed',
  [STATUS.PENDING]: 'Pending',
  [STATUS.FAILED]: 'Failed',
  [STATUS.ERROR]: 'Error',
  [STATUS.CANCELLED]: 'Cancelled'
};

// QR Code Types
export const QR_TYPES = {
  JSON: 'json',
  URL: 'url',
  CUSTOM: 'custom',
  PHONE: 'phone',
  RAW: 'raw',
  ERROR: 'error'
};

// User Roles
export const USER_ROLES = {
  CUSTOMER: 'customer',
  MERCHANT: 'merchant',
  ADMIN: 'admin'
};

// Firebase Config (from environment variables)
export const FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "mpesa-qr-backend.firebaseapp.com",
  projectId: "mpesa-qr-backend",
  storageBucket: "mpesa-qr-backend.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Validation Rules
export const VALIDATION = {
  PHONE_REGEX: /^254\d{9}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  AMOUNT_MIN: 1,
  AMOUNT_MAX: 70000
};

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_PHONE: 'Phone number must be in format 254XXXXXXXXX',
  INVALID_AMOUNT: 'Amount must be between 1 and 70,000 KES',
  INVALID_EMAIL: 'Please enter a valid email address',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  PAYMENT_FAILED: 'Payment failed. Please try again.',
  QR_SCAN_FAILED: 'Failed to scan QR code. Please try again.',
  INVALID_QR: 'Invalid QR code format'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  PAYMENT_SUCCESS: 'Payment completed successfully!',
  REGISTRATION_SUCCESS: 'Registration successful! Please login.',
  LOGIN_SUCCESS: 'Login successful!',
  QR_SCAN_SUCCESS: 'QR code scanned successfully'
};

// Default Values
export const DEFAULTS = {
  CURRENCY_SYMBOL: 'KSH',
  LOCALE: 'en-KE',
  TIMEZONE: 'Africa/Nairobi',
  PAGE_SIZE: 10,
  DEBOUNCE_DELAY: 300
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  STATUS,
  MPESA_CONFIG,
  APP_CONFIG,
  STATUS_VARIANTS,
  STATUS_LABELS,
  QR_TYPES,
  USER_ROLES,
  FIREBASE_CONFIG,
  VALIDATION,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  DEFAULTS
};