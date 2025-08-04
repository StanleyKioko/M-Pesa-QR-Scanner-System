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

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (role) => {
    if (role === 'customer') {
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

    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const token = await user.getIdToken();

      console.log('Firebase login successful:', user.uid);

      // Verify merchant exists in backend
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
          uid: user.uid
        });

        console.log('Backend verification successful:', response.data);

        const merchantData = {
          token,
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || response.data.user.name,
            ...response.data.user
          }
        };

        onLogin(role, merchantData);
      } catch (backendError) {
        console.error('Backend verification failed:', backendError);
        setError('Merchant account not found. Please register first.');
        // Sign out from Firebase since backend verification failed
        await auth.signOut();
      }

    } catch (error) {
      console.error('Login error:', error);
      
      // Handle specific Firebase errors
      switch (error.code) {
        case 'auth/user-not-found':
          setError('No account found with this email');
          break;
        case 'auth/wrong-password':
          setError('Incorrect password');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later');
          break;
        default:
          setError('Login failed. Please try again');
      }
    } finally {
      setLoading(false);
    }
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
              Continue as Customer
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
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="merchant@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleLogin('merchant');
                  }
                }}
              />
            </div>
            
            <Button 
              className="w-full" 
              onClick={() => handleLogin('merchant')}
              disabled={loading || !email || !password}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            
            <p className="text-xs text-gray-500 text-center">
              Use your registered merchant credentials
            </p>

            <div className="text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <a href="/register" className="text-blue-600 hover:underline">
                  Register here
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;