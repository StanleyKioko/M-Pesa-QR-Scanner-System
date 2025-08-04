import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    shortcode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate required fields
    if (!formData.email || !formData.password || !formData.name || !formData.phone || !formData.shortcode) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      
      // Register merchant in backend
      await axios.post('http://localhost:3000/auth/signup', {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
        shortcode: formData.shortcode
      });

      alert('Registration successful! Please login.');
      navigate('/login');
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h2 className="text-2xl font-bold mb-4 text-center">Merchant Registration</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-700 font-medium">Business Name</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your Business Name"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="business@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Phone Number</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="254712345678"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Business Shortcode</label>
          <input
            type="text"
            name="shortcode"
            value={formData.shortcode}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123456"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
            minLength="6"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium">Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
            minLength="6"
            required
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Registering...' : 'Register Merchant'}
        </button>

        {error && <p className="text-red-600 text-center">{error}</p>}

        <p className="text-center text-gray-600">
          Already have an account? 
          <Link to="/login" className="text-blue-600 hover:underline ml-1">Login here</Link>
        </p>
      </form>
    </div>
  );
}

export default Register;