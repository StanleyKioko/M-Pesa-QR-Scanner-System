import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from './constants';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - clear token and redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Authentication Services
export const authService = {
  signup: async (userData) => {
    const response = await api.post(API_ENDPOINTS.AUTH.SIGNUP, userData);
    return response.data;
  },

  login: async (credentials) => {
    const response = await api.post(API_ENDPOINTS.AUTH.LOGIN, credentials);
    return response.data;
  },

  logout: async () => {
    localStorage.removeItem('authToken');
    return { success: true };
  }
};

// Transaction Services
export const transactionService = {
  getAllTransactions: async () => {
    const response = await api.get(API_ENDPOINTS.TRANSACTIONS.GET_ALL);
    return response.data;
  },

  getTransactionById: async (transactionId) => {
    const response = await api.get(`${API_ENDPOINTS.TRANSACTIONS.GET_BY_ID}/${transactionId}`);
    return response.data;
  },

  createTransaction: async (transactionData) => {
    const response = await api.post(API_ENDPOINTS.TRANSACTIONS.CREATE, transactionData);
    return response.data;
  }
};

// M-Pesa Payment Services
export const paymentService = {
  triggerSTKPush: async (paymentData) => {
    const response = await api.post(API_ENDPOINTS.MPESA.STK_PUSH, paymentData);
    return response.data;
  },

  triggerSTKPushAlt: async (paymentData) => {
    const response = await api.post(API_ENDPOINTS.MPESA.TRIGGER_STK, paymentData);
    return response.data;
  }
};

// Generic API utility
export const apiCall = async (method, endpoint, data = null, config = {}) => {
  try {
    const response = await api({
      method,
      url: endpoint,
      data,
      ...config
    });
    return response.data;
  } catch (error) {
    console.error('API Call Error:', error);
    throw error;
  }
};

export default api;