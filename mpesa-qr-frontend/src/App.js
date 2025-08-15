import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Register from './components/Register';
import QRScanner from './components/QRScanner';
import PaymentConfirmation from './components/PaymentConfirmation';
import MerchantDashboard from './components/MerchantDashboard';
import { API_BASE_URL } from './utility/constants';
import axios from 'axios';

function App() {
  const [userRole, setUserRole] = useState(null); // 'customer' | 'merchant' | null
  const [appState, setAppState] = useState('login'); // 'login' | 'register' | 'scanner' | 'payment' | 'dashboard'
  const [currentPayment, setCurrentPayment] = useState(null);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  useEffect(() => {
    console.log('🔄 Setting up Firebase auth listener...');
    
    // Check if user is already logged in on app load
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔥 Firebase auth state changed:', firebaseUser ? firebaseUser.uid : 'No user');
      
      if (firebaseUser && !autoLoginAttempted) {
        setAutoLoginAttempted(true);
        
        try {
          console.log('✅ Firebase user found, attempting auto-login...');
          const idToken = await firebaseUser.getIdToken();
          
          // Verify merchant exists in backend before auto-login
          console.log('🏢 Verifying merchant in backend for auto-login...');
          // FIXED: Changed from /auth/login to /api/auth/login
          const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
            uid: firebaseUser.uid,
            email: firebaseUser.email
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            timeout: 10000
          });

          console.log('✅ Backend verification successful for auto-login:', response.data);

          setToken(idToken);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || response.data.user?.name,
            ...response.data.user
          });
          setUserRole('merchant');
          setAppState('dashboard');
          console.log('✅ Auto-login successful, redirecting to dashboard');
          console.log('User data:', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || response.data.user?.name
          });
        } catch (error) {
          console.error('❌ Auto-login failed:', error);
          
          // If backend verification fails, sign out from Firebase
          try {
            await signOut(auth);
            console.log('🚪 Signed out due to backend verification failure');
          } catch (signOutError) {
            console.error('⚠️ Error signing out:', signOutError);
          }
          
          resetAppState();
        }
      } else if (!firebaseUser) {
        console.log('👋 No Firebase user, going to login');
        resetAppState();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [autoLoginAttempted]);

  const resetAppState = () => {
    setToken(null);
    setUser(null);
    setUserRole(null);
    setAppState('login');
    setAutoLoginAttempted(false);
    setCurrentPayment(null);
  };

  const handleLogin = (role, authData = null) => {
    console.log('🔐 handleLogin called:', { role, hasAuthData: !!authData });
    
    setUserRole(role);
    if (role === 'customer') {
      console.log('👤 Customer login, going to scanner');
      setAppState('scanner');
    } else if (role === 'merchant') {
      if (authData && authData.token && authData.user) {
        console.log('🏢 Merchant login successful, setting data:', authData.user);
        setToken(authData.token);
        setUser(authData.user);
        setAppState('dashboard');
        console.log('✅ App state set to dashboard');
      } else {
        console.error('❌ Merchant login without proper auth data:', authData);
        setAppState('login');
      }
    }
  };

  const handleLogout = async () => {
    console.log('🚪 Logout initiated...');
    
    // Show loading state
    setLoading(true);
    
    try {
      if (userRole === 'merchant' && auth.currentUser) {
        console.log('🔥 Signing out from Firebase...');
        await signOut(auth);
        console.log('✅ Firebase signout successful');
      }
      
      // Clear all state
      resetAppState();
      console.log('✅ Logout complete, redirecting to login');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if logout fails, reset the app state
      resetAppState();
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateToRegister = () => {
    console.log('📝 Navigate to register');
    setAppState('register');
  };

  const handleNavigateToLogin = () => {
    console.log('🔐 Navigate to login');
    setAppState('login');
  };

  // NEW: Navigate back to landing page without logout
  const handleNavigateToLanding = () => {
    console.log('🏠 Navigate back to landing page');
    // Don't reset user data, just change app state
    setAppState('login');
    setCurrentPayment(null);
  };

  // NEW: Navigate to scanner from merchant dashboard  
  const handleNavigateToScanner = () => {
    console.log('📷 Navigate to scanner from dashboard');
    setAppState('scanner');
  };

  // NEW: Navigate to dashboard from scanner
  const handleNavigateToDashboard = () => {
    console.log('📊 Navigate to dashboard from scanner');
    if (userRole === 'merchant') {
      setAppState('dashboard');
    }
  };

  const handlePaymentInitiated = (paymentData) => {
    console.log('💳 Payment initiated:', paymentData);
    setCurrentPayment(paymentData);
    setAppState('payment');
  };

  const handleBackToScanner = () => {
    console.log('📷 Back to scanner');
    setCurrentPayment(null);
    setAppState('scanner');
  };

  const handleBackToDashboard = () => {
    console.log('📊 Back to dashboard');
    setCurrentPayment(null);
    setAppState('dashboard');
  };

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {appState === 'login' ? 'Loading...' : 'Signing out...'}
          </p>
        </div>
      </div>
    );
  }

  // Render based on app state
  switch (appState) {
    case 'register':
      return (
        <Register 
          onNavigateToLogin={handleNavigateToLogin}
          onRegistrationSuccess={handleNavigateToLogin}
        />
      );
    
    case 'scanner':
      return (
        <QRScanner 
          onPaymentInitiated={handlePaymentInitiated}
          onLogout={handleLogout}
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
          onBack={userRole === 'customer' ? handleBackToScanner : handleBackToDashboard}
          userRole={userRole}
        />
      );
    
    case 'dashboard':
      return (
        <MerchantDashboard 
          user={user}
          token={token}
          onLogout={handleLogout}
          onNavigateToLanding={handleNavigateToLanding}
          onNavigateToScanner={handleNavigateToScanner}
        />
      );
    
    default:
      return (
        <Login 
          onLogin={handleLogin} 
          onNavigateToRegister={handleNavigateToRegister}
          user={user}
          userRole={userRole}
        />
      );
  }
}

export default App;