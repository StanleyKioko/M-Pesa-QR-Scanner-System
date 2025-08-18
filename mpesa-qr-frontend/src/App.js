import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import QRScanner from './components/QRScanner';
import MerchantDashboard from './components/MerchantDashboard';
import CustomerDashboard from './components/CustomerDashboard'; // NEW
import MerchantQRGenerator from './components/MerchantQRGenerator';
import PaymentLink from './components/PaymentLink';
import PaymentConfirmation from './components/PaymentConfirmation';
import { useAuth } from './hooks/useAuth';
import './index.css';

function App() {
  // Navigation state
  const [currentView, setCurrentView] = useState('landing');
  const [currentPayment, setCurrentPayment] = useState(null);
  
  // Auth state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userRole, setUserRole] = useState('customer'); // 'customer' or 'merchant'

  // Navigation handlers
  const handleNavigateToLanding = () => {
    setCurrentView('landing');
  };

  const handleNavigateToRegister = () => {
    setCurrentView('register');
  };

  const handleNavigateToLogin = () => {
    setCurrentView('landing');
  };

  const handleNavigateToScanner = () => {
    setCurrentView('scanner');
  };

  const handleNavigateToDashboard = () => {
    setCurrentView('dashboard');
  };

  // NEW: QR Generator navigation
  const handleNavigateToQRGenerator = () => {
    setCurrentView('qr-generator');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  const handleBackToScanner = () => {
    setCurrentView('scanner');
  };

  // Auth handlers - UPDATED to handle customer vs merchant properly
  const handleLogin = (role, userData) => {
    if (role === 'customer') {
      // Customer login - no auth data needed
      setUser(null);
      setToken(null);
      setUserRole('customer');
      // Clear any existing merchant data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setCurrentView('dashboard'); // Will show CustomerDashboard
    } else if (role === 'merchant' && userData) {
      // Merchant login - requires auth data
      setUser(userData.user);
      setToken(userData.token);
      setUserRole('merchant');
      localStorage.setItem('token', userData.token);
      localStorage.setItem('user', JSON.stringify(userData.user));
      setCurrentView('dashboard'); // Will show MerchantDashboard
    }
  };

  const handleRegister = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setUserRole('merchant'); // Registered users are merchants
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setUserRole('customer'); // Default back to customer
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentView('landing');
  };

  // Payment handlers
  const handlePaymentInitiated = (paymentData) => {
    setCurrentPayment(paymentData);
    setCurrentView('payment');
  };

  // Initialize app state from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setToken(savedToken);
        setUserRole('merchant');
        setCurrentView('dashboard');
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    // Handle URL-based routing for payment links
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('data')) {
      setCurrentView('payment-link');
    }
  }, []);

  // Render appropriate component based on current view
  const renderCurrentView = () => {
    switch (currentView) {
      case 'landing':
        return (
          <Login 
            onLogin={handleLogin} 
            onNavigateToRegister={handleNavigateToRegister}
            onNavigateToScanner={handleNavigateToScanner}
          />
        );
      
      case 'register':
        return (
          <Register 
            onRegister={handleRegister} 
            onNavigateToLogin={handleNavigateToLogin}
          />
        );
      
      case 'scanner':
        return (
          <QRScanner 
            onPaymentInitiated={handlePaymentInitiated}
            onLogout={user ? handleLogout : null}
            onNavigateToLanding={handleNavigateToLanding}
            onNavigateToDashboard={userRole === 'merchant' ? handleNavigateToDashboard : null}
            token={token}
            userRole={userRole}
          />
        );
      
      case 'payment':
        return (
          <PaymentConfirmation 
            paymentData={currentPayment}
            onBack={userRole === 'customer' ? handleBackToDashboard : handleBackToDashboard}
            userRole={userRole}
          />
        );
      
      case 'dashboard':
        // UPDATED: Show different dashboards based on user role
        if (userRole === 'customer') {
          return (
            <CustomerDashboard 
              onPaymentInitiated={handlePaymentInitiated}
              onNavigateToScanner={handleNavigateToScanner}
              onNavigateToLanding={handleNavigateToLanding}
              onLogout={handleLogout}
              userRole={userRole}
              token={token}
            />
          );
        } else {
          return (
            <MerchantDashboard 
              user={user}
              token={token}
              onLogout={handleLogout}
              onNavigateToLanding={handleNavigateToLanding}
              onNavigateToScanner={handleNavigateToScanner}
              onNavigateToQRGenerator={handleNavigateToQRGenerator}
            />
          );
        }
      
      // NEW: QR Generator route
      case 'qr-generator':
        return (
          <MerchantQRGenerator 
            user={user}
            onBack={handleBackToDashboard}
          />
        );
      
      // NEW: Payment Link route (for URL-based payments)
      case 'payment-link':
        return <PaymentLink />;
      
      default:
        return (
          <Login 
            onLogin={handleLogin} 
            onNavigateToRegister={handleNavigateToRegister}
            onNavigateToScanner={handleNavigateToScanner}
          />
        );
    }
  };

  return (
    <Router>
      <div className="App">
        {renderCurrentView()}
      </div>
    </Router>
  );
}

export default App;