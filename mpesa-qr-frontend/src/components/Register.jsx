import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Label from './ui/Label';
import { ArrowLeft, Building, AlertCircle, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../utility/constants';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Register({ onNavigateToLogin, onRegistrationSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    shortcode: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const navigate = useNavigate();


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleBackToLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    }
  };

  const validateForm = () => {
    const { name, email, password, confirmPassword, phone, shortcode } = formData;

    if (!name || !email || !password || !confirmPassword || !phone || !shortcode) {
      return 'All fields are required';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }

    if (password.length < 6) {
      return 'Password must be at least 6 characters';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }

    if (!phone.startsWith('254') || phone.length < 12) {
      return 'Phone number should start with 254 and be at least 12 digits';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const { name, email, password, phone, shortcode } = formData;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      try {
        await updateProfile(user, {
          displayName: name
        });
      } catch (profileError) {
        // Profile update failed, but continue with registration
      }

      const idToken = await user.getIdToken();

      const backendData = {
        uid: user.uid,
        email,
        password,
        name,
        phone,
        shortcode
      };

      const response = await axios.post(`${API_BASE_URL}/api/auth/signup`, backendData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        timeout: 15000
      });

      setSuccess('Registration successful! Redirecting to login...');

      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        shortcode: ''
      });

      setTimeout(() => {
        if (onRegistrationSuccess) {
          onRegistrationSuccess();
        } else if (onNavigateToLogin) {
          onNavigateToLogin();
        }
      }, 2000);

    } catch (error) {
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            setError('An account with this email already exists.');
            break;
          case 'auth/invalid-email':
            setError('Invalid email address format.');
            break;
          case 'auth/weak-password':
            setError('Password is too weak. Please use at least 6 characters.');
            break;
          case 'auth/network-request-failed':
            setError('Network error. Please check your internet connection.');
            break;
          default:
            setError(`Firebase error: ${error.message}`);
        }
      } else if (error.response) {
        const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Backend registration failed';
        setError(`Registration failed: ${errorMessage}`);

        if (auth.currentUser) {
          try {
            await auth.currentUser.delete();
          } catch (deleteError) {
            // Failed to cleanup Firebase user
          }
        }
      } else {
        setError('Network error. Please check your connection and try again.');
        
        if (auth.currentUser) {
          try {
            await auth.currentUser.delete();
          } catch (deleteError) {
            // Failed to cleanup Firebase user
          }
        }
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
            <div className="flex items-center justify-center mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToLogin}
                className="mr-2"
                disabled={loading}
                type="button"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Building className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <CardTitle>Merchant Registration</CardTitle>
            <CardDescription>
              Create your merchant account to start accepting payments
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Business Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your business name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Create a password (min. 6 characters)"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="254708374149"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <Label htmlFor="shortcode">Business Shortcode</Label>
                <Input
                  id="shortcode"
                  name="shortcode"
                  type="text"
                  placeholder="Enter your M-Pesa shortcode"
                  value={formData.shortcode}
                  onChange={handleChange}
                  disabled={loading}
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Merchant Account'}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => navigate('/login')}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Already have an account? Login here
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Register;