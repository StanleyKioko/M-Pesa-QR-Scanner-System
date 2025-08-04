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
  const [appState, setAppState] = useState('login'); // 'login' | 'scanner' | 'payment' | 'dashboard'
  const [currentPayment, setCurrentPayment] = useState(null);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in on app load
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        setToken(idToken);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName
        });
        setUserRole('merchant'); // Firebase users are merchants
        setAppState('dashboard');
      } else {
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
    setUserRole(role);
    if (role === 'customer') {
      setAppState('scanner');
    } else if (role === 'merchant') {
      if (authData) {
        setToken(authData.token);
        setUser(authData.user);
      }
      setAppState('dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      if (userRole === 'merchant') {
        await signOut(auth);
      }
      setUserRole(null);
      setAppState('login');
      setCurrentPayment(null);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
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

  const handleBackToDashboard = () => {
    setAppState('dashboard');
  };

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
      return <Login onLogin={handleLogin} />;
    
    case 'scanner':
      return (
        <QRScanner
          onBack={handleLogout}
          onPaymentInitiated={handlePaymentInitiated}
          token={token}
        />
      );
    
    case 'payment':
      return (
        <PaymentConfirmation 
          paymentData={currentPayment}
          onBack={handleBackToScanner}
          onNewPayment={handleNewPayment}
          token={token}
        />
      );
    
    case 'dashboard':
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
      return <Login onLogin={handleLogin} />;
  }
}

export default App;