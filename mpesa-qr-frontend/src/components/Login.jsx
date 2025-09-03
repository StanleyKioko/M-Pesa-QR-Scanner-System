import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import Input from './ui/Input';
import Label from './ui/Label';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle,
  QrCode,
  Store,
  Building,
  TrendingUp,
  Shield
} from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { API_BASE_URL } from '../utility/constants';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

const Login = ({ onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { setMerchantData } = useAuth();
  const navigate = useNavigate();

  const handleMerchantLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔐 Starting Firebase authentication...');
      
      // Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('✅ Firebase auth successful, getting token...');
      
      // Get Firebase ID token
      const idToken = await user.getIdToken();
      
      console.log('📞 Verifying with backend...', `${API_BASE_URL}/api/auth/verify-token`);
      
      // Verify with backend and get user data
      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-token`, {
        idToken: idToken
      }, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('📥 Backend response:', response.data);

      if (response.data.success) {
        const userData = {
          user: response.data.user,
          token: idToken
        };
        
        console.log('✅ Login successful, redirecting to dashboard...');
        
        // Store user data in auth context
        setMerchantData(response.data.user);
        
        // Save token to localStorage for API calls
        localStorage.setItem('authToken', idToken);
        
        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      
      let errorMessage = 'Login failed. Please try again.';
      
      // Handle different error types
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else if (err.code === 'ECONNREFUSED') {
        errorMessage = 'Backend server is not running. Please contact support.';
      } else if (err.code === 'NETWORK_ERROR' || err.message?.includes('Network Error')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Backend service unavailable. Please try again later.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message && !err.code) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-full w-fit mx-auto shadow-lg">
            <QrCode className="w-10 h-10 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">M-Pesa QR Pay</h1>
            <p className="text-xl text-gray-600">Merchant Portal</p>
            <p className="text-sm text-gray-500 mt-2">
              Manage your business payments and QR codes
            </p>
          </div>
        </div>

        {/* Merchant Login Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-3 pb-6">
            <div className="flex items-center justify-center gap-3">
              <div className="bg-blue-100 p-3 rounded-xl">
                <Store className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-center">
                <CardTitle className="text-2xl text-gray-900">Merchant Login</CardTitle>
                <CardDescription className="text-gray-600">
                  Access your business dashboard
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleMerchantLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your business email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 h-12"
                  icon={Mail}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 h-12 pr-12"
                    icon={Lock}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading} 
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-semibold text-white shadow-lg transition-all duration-200"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <span>Sign In to Dashboard</span>
                )}
              </Button>
              
              {/* Registration Link */}
              <div className="text-center mt-4">
                <p className="text-gray-600 text-sm">
                  Don't have an account yet?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/register')}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Register your business
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white rounded-xl p-4 shadow-md flex items-start gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <QrCode className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Custom QR Codes</h3>
              <p className="text-sm text-gray-600">Generate and manage custom payment QR codes for your business</p>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md flex items-start gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Transaction Reports</h3>
              <p className="text-sm text-gray-600">Monitor all incoming payments and transaction history</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;