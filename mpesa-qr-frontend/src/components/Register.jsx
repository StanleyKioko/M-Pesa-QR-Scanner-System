import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Label from './ui/Label';
import { ArrowLeft, Building } from 'lucide-react';
import { API_BASE_URL } from '../utility/constants';
import axios from 'axios';

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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear errors when user starts typing
    if (error) setError('');
  };

  const validateForm = () => {
    const { name, email, password, confirmPassword, phone, shortcode } = formData;

    if (!name || !email || !password || !confirmPassword || !phone || !shortcode) {
      setError('All fields are required');
      return false;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (!/^254\d{9}$/.test(phone)) {
      setError('Phone number must be in format 254XXXXXXXXX');
      return false;
    }

    if (!/^\d{5,6}$/.test(shortcode)) {
      setError('Shortcode must be 5-6 digits');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    console.log('📝 Starting registration process...');
    console.log('📧 Registration data:', {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      shortcode: formData.shortcode
    });
    console.log('🌐 API_BASE_URL:', API_BASE_URL);

    try {
      const { name, email, password, phone, shortcode } = formData;

      console.log('🔥 Creating Firebase user...');
      // Create user in Firebase Authentication first
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log('✅ Firebase user created successfully:', {
        uid: user.uid,
        email: user.email
      });

      // Update display name in Firebase
      try {
        await updateProfile(user, {
          displayName: name
        });
        console.log('✅ Firebase profile updated with display name');
      } catch (profileError) {
        console.warn('⚠️ Failed to update Firebase profile:', profileError);
        // Continue anyway, this is not critical
      }

      console.log('🏢 Registering merchant in backend...');
      console.log('📡 Making request to:', `${API_BASE_URL}/auth/signup`);

      // Get Firebase ID token for backend verification
      const idToken = await user.getIdToken();
      console.log('🔑 Firebase ID token obtained');

      // Register merchant in backend - IMPORTANT: Include uid in the request
      const backendData = {
        uid: user.uid,  // This is crucial - backend needs to know the Firebase UID
        email,
        password,
        name,
        phone,
        shortcode
      };

      console.log('📤 Sending data to backend:', backendData);

      const response = await axios.post(`${API_BASE_URL}/auth/signup`, backendData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        timeout: 15000 // 15 seconds timeout
      });

      console.log('✅ Backend registration successful:', response.data);

      setSuccess('Registration successful! Redirecting to login...');
      
      // Clear form
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        shortcode: ''
      });

      console.log('🎉 Registration complete, redirecting to login...');

      // Call the callback to handle navigation after a short delay
      setTimeout(() => {
        if (onRegistrationSuccess) {
          console.log('📞 Calling onRegistrationSuccess callback');
          onRegistrationSuccess();
        } else if (onNavigateToLogin) {
          console.log('📞 Calling onNavigateToLogin callback');
          onNavigateToLogin();
        } else {
          console.warn('⚠️ No navigation callback provided');
        }
      }, 2000);

    } catch (error) {
      console.error('❌ Registration error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });

      // Handle Firebase errors
      if (error.code) {
        console.log('🔥 Firebase error detected:', error.code);
        switch (error.code) {
          case 'auth/email-already-in-use':
            setError('An account with this email already exists. Please try logging in instead.');
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
        // Handle backend errors
        console.log('🏢 Backend error detected:', {
          status: error.response.status,
          data: error.response.data
        });
        
        const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Backend registration failed';
        setError(`Registration failed: ${errorMessage}`);

        // If backend registration failed, clean up Firebase user
        if (auth.currentUser) {
          try {
            console.log('🧹 Cleaning up Firebase user due to backend error...');
            await auth.currentUser.delete();
            console.log('✅ Firebase user cleanup successful');
          } catch (deleteError) {
            console.error('❌ Failed to cleanup Firebase user:', deleteError);
          }
        }
      } else {
        // Network or other errors
        console.log('🌐 Network/other error:', error.message);
        setError('Network error. Please check your connection and try again.');
        
        // Clean up Firebase user if it was created
        if (auth.currentUser) {
          try {
            console.log('🧹 Cleaning up Firebase user due to network error...');
            await auth.currentUser.delete();
            console.log('✅ Firebase user cleanup successful');
          } catch (deleteError) {
            console.error('❌ Failed to cleanup Firebase user:', deleteError);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    console.log('🔙 Navigating back to login...');
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else {
      console.warn('⚠️ onNavigateToLogin callback not provided');
    }
  };

  const clearError = () => {
    setError('');
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
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-green-600 text-sm">{success}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Business Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your Business Name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  autoComplete="organization"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="business@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
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
                  autoComplete="tel"
                />
                <p className="text-xs text-gray-500">Format: 254XXXXXXXXX</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortcode">Business Shortcode</Label>
                <Input
                  id="shortcode"
                  name="shortcode"
                  type="text"
                  placeholder="174379"
                  value={formData.shortcode}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500">5-6 digit business shortcode</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Account...
                  </span>
                ) : (
                  'Register Merchant'
                )}
              </Button>
            </form>

            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={handleBackToLogin}
                  className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                  disabled={loading}
                  type="button"
                >
                  Login here
                </button>
              </p>
            </div>

            {/* Debug Info (development only) */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="text-xs text-gray-400 cursor-pointer">Debug Info</summary>
                <div className="text-xs text-gray-400 mt-2 space-y-1">
                  <p>API URL: {API_BASE_URL}</p>
                  <p>Firebase Auth: {auth.currentUser ? `Logged in as ${auth.currentUser.email}` : 'Not authenticated'}</p>
                  <p>Environment: {process.env.NODE_ENV}</p>
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Register;