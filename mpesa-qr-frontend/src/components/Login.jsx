import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Label from './ui/Label';
import { User, Building, AlertCircle, CheckCircle, QrCode, Camera } from 'lucide-react';
import { API_BASE_URL } from '../utility/constants';
import axios from 'axios';

const Login = ({ onLogin, onNavigateToRegister, onNavigateToScanner }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (role) => {
    if (role === 'customer') {
      onLogin(role, null);
      return;
    }

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const token = await user.getIdToken();

      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
          uid: user.uid,
          email: user.email
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 10000
        });

        const merchantData = {
          token,
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || response.data.user?.name || email,
            ...response.data.user
          }
        };

        setEmail('');
        setPassword('');
        
        onLogin(role, merchantData);
        
      } catch (backendError) {
        if (backendError.response?.status === 404) {
          setError('Merchant profile not found. Please contact support or register a new account.');
        } else if (backendError.code === 'ECONNREFUSED' || backendError.code === 'NETWORK_ERROR') {
          setError('Cannot connect to server. Please ensure the backend server is running.');
        } else {
          setError(`Login failed: ${backendError.response?.data?.error || backendError.message}`);
        }
      }
      
    } catch (firebaseError) {
      switch (firebaseError.code) {
        case 'auth/user-not-found':
          setError('No account found with this email. Please register first.');
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
          setError('Too many failed login attempts. Please try again later.');
          break;
        case 'auth/network-request-failed':
          setError('Network error. Please check your internet connection.');
          break;
        default:
          setError(`Login failed: ${firebaseError.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <QrCode className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle>M-Pesa QR Scanner</CardTitle>
            <CardDescription>
              Scan QR codes to make instant payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                <span className="text-sm text-green-700">{success}</span>
              </div>
            )}

            {/* Customer Section - Primary Focus */}
            <div className="mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <Camera className="w-6 h-6 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-green-800">Ready to Pay?</h3>
                    <p className="text-sm text-green-700">
                      Scan merchant QR codes and pay instantly with M-Pesa
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Button
                    onClick={() => handleLogin('customer')}
                    disabled={loading}
                    className="w-full flex items-center justify-center py-3 bg-green-600 hover:bg-green-700"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Start Scanning & Paying
                  </Button>
                  
                  <p className="text-xs text-green-600 text-center">
                    No registration required • Scan • Pay • Done
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-100 px-3 text-gray-500 font-medium">
                  For Business Owners
                </span>
              </div>
            </div>

            {/* Merchant Section - Secondary */}
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">
                  Generate QR codes and manage payments
                </p>
              </div>
              
              <div>
                <Label htmlFor="email">Business Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your business email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button
                onClick={() => handleLogin('merchant')}
                disabled={loading || !email || !password}
                className="w-full flex items-center justify-center py-3"
                variant="outline"
              >
                <Building className="w-5 h-5 mr-2" />
                {loading ? 'Signing In...' : 'Login as Merchant'}
              </Button>

              <div className="text-center">
                <Button
                  variant="link"
                  onClick={onNavigateToRegister}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Don't have a merchant account? Register here
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;