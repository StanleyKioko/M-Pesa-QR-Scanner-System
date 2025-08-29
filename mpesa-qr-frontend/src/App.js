import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import Login from './components/Login';
import Register from './components/Register';
import MerchantDashboard from './components/MerchantDashboard';
import MerchantQRGenerator from './components/MerchantQRGenerator';
import PublicQRScanner from './components/PublicQRScanner';
import Transactions from './components/Transactions';
import QRPaymentScanner from './components/QRPaymentScanner';
import PrivateRoute from './utility/PrivateRoute';
import PayPrompt from "./components/PayPrompt";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Public routes */}
          <Route path="/scan" element={<PublicQRScanner />} />
          <Route path="/pay" element={<PayPrompt />} />
          
          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <MerchantDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/generate-qr" 
            element={
              <PrivateRoute>
                <MerchantQRGenerator />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/transactions" 
            element={
              <PrivateRoute>
                <Transactions />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/payment-scanner" 
            element={
              <PrivateRoute>
                <QRPaymentScanner />
              </PrivateRoute>
            } 
          />
          
          {/* Default route - redirect to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;