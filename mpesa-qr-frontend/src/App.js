import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

// Import existing components
import QRScanner from './components/QRScanner';
import Transactions from './components/Transactions';
import Login from './components/Login';
import Register from './components/Register';
import MerchantDashboard from './components/MerchantDashboard';
import PaymentConfirmation from './components/PaymentConfirmation';

function App() {
  const [userRole, setUserRole] = useState(null); // 'customer' | 'merchant' | null
  const [appState, setAppState] = useState('login'); // 'login' | 'register' | 'scanner' | 'payment' | 'dashboard'
  const [currentPayment, setCurrentPayment] = useState(null);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔄 Setting up Firebase auth listener...');
    
    // Check if user is already logged in on app load
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔥 Firebase auth state changed:', firebaseUser ? firebaseUser.uid : 'No user');
      
      if (firebaseUser) {
        try {
          console.log('✅ Firebase user found, getting token...');
          const idToken = await firebaseUser.getIdToken();
          
          setToken(idToken);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName
          });
          setUserRole('merchant'); // Firebase users are merchants
          setAppState('dashboard');
          
          console.log('✅ Auto-login successful, redirecting to dashboard');
          console.log('User data:', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName
          });
        } catch (error) {
          console.error('❌ Error getting token:', error);
          setToken(null);
          setUser(null);
          setUserRole(null);
          setAppState('login');
        }
      } else {
        console.log('👋 No Firebase user, going to login');
        setToken(null);
        setUser(null);
        setUserRole(null);
        setAppState('login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (role, authData = null) => {
    console.log('🔐 handleLogin called:', { role, hasAuthData: !!authData });
    
    setUserRole(role);
    if (role === 'customer') {
      console.log('👤 Customer login, going to scanner');
      setAppState('scanner');
    } else if (role === 'merchant') {
      if (authData) {
        console.log('🏢 Merchant login successful, setting data:', authData.user);
        setToken(authData.token);
        setUser(authData.user);
        setAppState('dashboard');
        console.log('✅ App state set to dashboard');
      } else {
        console.error('❌ Merchant login without auth data');
        setAppState('login');
      }
    }
  };

  const handleLogout = async () => {
    console.log('🚪 Logout initiated...');
    try {
      if (userRole === 'merchant') {
        console.log('🔥 Signing out from Firebase...');
        await signOut(auth);
      }
      setUserRole(null);
      setAppState('login');
      setCurrentPayment(null);
      setToken(null);
      setUser(null);
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const handlePaymentInitiated = (paymentData) => {
    setCurrentPayment(paymentData);
    setAppState('payment');
  };

  const handleBackToScanner = () => {
    setAppState('scanner');
  };

  const handleNewPayment = () => {
    setCurrentPayment(null);
    setAppState('scanner');
  };

  const handleNavigateToRegister = () => {
    setAppState('register');
  };

  const handleNavigateToLogin = () => {
    setAppState('login');
  };

  const handleRegistrationSuccess = () => {
    setAppState('login');
  };

  // Debug current state
  console.log('📱 App render state:', {
    appState,
    userRole,
    hasToken: !!token,
    hasUser: !!user,
    loading
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Enhanced Landing Page Flow
  switch (appState) {
    case 'login':
      console.log('🔑 Rendering Login component');
      return (
        <Login 
          onLogin={handleLogin} 
          onNavigateToRegister={handleNavigateToRegister}
        />
      );
    
    case 'register':
      console.log('📝 Rendering Register component');
      return (
        <Register 
          onNavigateToLogin={handleNavigateToLogin}
          onRegistrationSuccess={handleRegistrationSuccess}
        />
      );
    
    case 'scanner':
      console.log('📱 Rendering QRScanner component');
      return (
        <QRScanner
          onBack={handleLogout}
          onPaymentInitiated={handlePaymentInitiated}
          token={token}
        />
      );
    
    case 'payment':
      console.log('💳 Rendering PaymentConfirmation component');
      return (
        <PaymentConfirmation 
          paymentData={currentPayment}
          onBack={handleBackToScanner}
          onNewPayment={handleNewPayment}
          token={token}
        />
      );
    
    case 'dashboard':
      console.log('📊 Rendering Dashboard with Router');
      return (
        <Router>
          <Routes>
            <Route path="/" element={<MerchantDashboard onBack={handleLogout} user={user} token={token} />} />
            <Route path="/scanner" element={<QRScanner token={token} user={user} />} />
            <Route path="/transactions" element={<Transactions token={token} user={user} />} />
            <Route path="/login" element={<Login setToken={setToken} setUser={setUser} />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </Router>
      );
    
    default:
      console.log('❓ Default case, rendering Login');
      return (
        <Login 
          onLogin={handleLogin} 
          onNavigateToRegister={handleNavigateToRegister}
        />
      );
  }
}

export default App;