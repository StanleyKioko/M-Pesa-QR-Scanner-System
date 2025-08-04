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

function Register() {
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

    try {
      const { name, email, password, phone, shortcode } = formData;

      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name
      await updateProfile(user, {
        displayName: name
      });

      console.log('Firebase user created:', user.uid);

      // Register merchant in backend
      const response = await axios.post(`${API_BASE_URL}/auth/signup`, {
        email,
        password,
        name,
        phone,
        shortcode
      });

      console.log('Backend registration successful:', response.data);

      setSuccess('Registration successful! You can now login.');
      
      // Clear form
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        shortcode: ''
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);

    } catch (error) {
      console.error('Registration error:', error);

      // Handle Firebase errors
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            setError('An account with this email already exists');
            break;
          case 'auth/invalid-email':
            setError('Invalid email address');
            break;
          case 'auth/weak-password':
            setError('Password is too weak');
            break;
          default:
            setError('Registration failed: ' + error.message);
        }
      } else {
        // Handle backend errors
        const errorMessage = error.response?.data?.error || 'Registration failed';
        setError(errorMessage);

        // If backend registration failed, clean up Firebase user
        if (auth.currentUser) {
          try {
            await auth.currentUser.delete();
          } catch (deleteError) {
            console.error('Failed to cleanup Firebase user:', deleteError);
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
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Building className="w-8 h-8 text-green-600" />
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
                  <p className="text-red-600 text-sm">{error}</p>
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="business@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  required
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
                />
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Register Merchant'}
              </Button>
            </form>

            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <a href="/" className="text-blue-600 hover:underline">
                  Login here
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Register;