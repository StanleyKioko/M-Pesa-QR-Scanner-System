import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Label from './ui/Label';
import { User, Building, AlertCircle, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../utility/constants';
import axios from 'axios';

const Login = ({ onLogin, onNavigateToRegister }) => {
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
              <Building className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle>M-Pesa QR Scanner</CardTitle>
            <CardDescription>
              Choose your role to continue
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

            <div className="mb-4">
              <Button
                onClick={() => handleLogin('customer')}
                disabled={loading}
                className="w-full flex items-center justify-center py-3"
                variant="outline"
              >
                <User className="w-5 h-5 mr-2" />
                Continue as Customer
              </Button>
            </div>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">
                  Or login as merchant
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
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
              >
                <Building className="w-5 h-5 mr-2" />
                {loading ? 'Signing In...' : 'Login as Merchant'}
              </Button>
            </div>

            <div className="mt-6 text-center">
              <Button
                variant="link"
                onClick={onNavigateToRegister}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Don't have a merchant account? Register here
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;