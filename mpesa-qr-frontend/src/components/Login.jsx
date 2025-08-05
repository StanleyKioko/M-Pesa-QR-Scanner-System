import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Label from './ui/Label';
import { User, Building } from 'lucide-react';
import { API_BASE_URL } from '../utility/constants';
import axios from 'axios';

const Login = ({ onLogin, onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (role) => {
    if (role === 'customer') {
      console.log('👤 Customer login selected');
      // For customers, just demo login without authentication
      onLogin(role, null);
      return;
    }

    // For merchants, authenticate with Firebase
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');

    console.log('🔐 Starting merchant login...');
    console.log('📧 Email:', email);
    console.log('🌐 API_BASE_URL:', API_BASE_URL);

    try {
      console.log('🔥 Signing in with Firebase...');
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const token = await user.getIdToken();

      console.log('✅ Firebase login successful:', {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified
      });

      // Verify merchant exists in backend
      try {
        console.log('🏢 Verifying merchant in backend...');
        console.log('📡 Making request to:', `${API_BASE_URL}/auth/login`);
        
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
          uid: user.uid,
          email: user.email
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 10000 // 10 seconds timeout
        });

        console.log('✅ Backend verification successful:', response.data);

        const merchantData = {
          token,
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || response.data.user?.name || email,
            ...response.data.user
          }
        };

        console.log('🎉 Login complete, calling onLogin callback with data:', merchantData);
        onLogin(role, merchantData);
        
      } catch (backendError) {
        console.error('❌ Backend verification failed:', {
          message: backendError.message,
          response: backendError.response?.data,
          status: backendError.response?.status,
          config: {
            url: backendError.config?.url,
            method: backendError.config?.method,
            data: backendError.config?.data
          }
        });

        if (backendError.response?.status === 404) {
          setError('Merchant account not found. Please register first.');
        } else if (backendError.code === 'ECONNREFUSED' || backendError.code === 'NETWORK_ERROR') {
          setError('Cannot connect to server. Please check your connection.');
        } else if (backendError.response?.status === 500) {
          setError('Server error. Please try again later.');
        } else {
          setError(backendError.response?.data?.message || 'Login verification failed. Please try again.');
        }
        
        // Sign out from Firebase since backend verification failed
        try {
          await auth.signOut();
          console.log('🚪 Signed out from Firebase due to backend error');
        } catch (signOutError) {
          console.error('⚠️ Error signing out from Firebase:', signOutError);
        }
      }

    } catch (error) {
      console.error('❌ Firebase login error:', {
        code: error.code,
        message: error.message,
        email: email
      });
      
      // Handle specific Firebase errors
      switch (error.code) {
        case 'auth/user-not-found':
          setError('No account found with this email address.');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password. Please try again.');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address format.');
          break;
        case 'auth/user-disabled':
          setError('This account has been disabled.');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.');
          break;
        case 'auth/network-request-failed':
          setError('Network error. Please check your internet connection.');
          break;
        case 'auth/invalid-credential':
          setError('Invalid email or password.');
          break;
        default:
          setError(`Login failed: ${error.message || 'Please try again'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClick = () => {
    console.log('📝 Navigate to register clicked');
    if (onNavigateToRegister) {
      onNavigateToRegister();
    } else {
      console.warn('⚠️ onNavigateToRegister callback not provided');
    }
  };

  const clearError = () => {
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Login */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle>Customer Login</CardTitle>
            <CardDescription>
              Scan QR codes and make payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => handleLogin('customer')}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Continue as Customer'}
            </Button>
            <p className="text-xs text-gray-500 text-center mt-2">
              No registration required for customers
            </p>
          </CardContent>
        </Card>

        {/* Merchant Login */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Building className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle>Merchant Login</CardTitle>
            <CardDescription>
              Access your dashboard and manage transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="flex justify-between items-start">
                  <p className="text-red-600 text-sm flex-1">{error}</p>
                  <button 
                    onClick={clearError}
                    className="text-red-400 hover:text-red-600 ml-2"
                    type="button"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="merchant@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) clearError();
                }}
                disabled={loading}
                required
                autoComplete="email"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
                disabled={loading}
                required
                autoComplete="current-password"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading && email && password) {
                    handleLogin('merchant');
                  }
                }}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={() => handleLogin('merchant')}
              disabled={loading || !email || !password}
              type="button"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
            
            <p className="text-xs text-gray-500 text-center">
              Use your registered merchant credentials
            </p>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button 
                  onClick={handleRegisterClick}
                  className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                  disabled={loading}
                  type="button"
                >
                  Register here
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;