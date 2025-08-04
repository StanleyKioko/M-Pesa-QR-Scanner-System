import { useState } from 'react';
import axios from 'axios';

function QRScanner({ token, user }) {
  const [phoneNumber, setPhoneNumber] = useState('254708374149');
  const [amount, setAmount] = useState('1');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    if (!token) {
      setError('Please login to initiate payments');
      setLoading(false);
      return;
    }

    if (!phoneNumber || !amount) {
      setError('Phone number and amount are required');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post('http://localhost:3000/daraja/scan-qr', {
        phoneNumber,
        amount: parseFloat(amount),
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      
      console.log('STK Push Response:', response.data);
      
      if (response.data.status === 'success') {
        setMessage(`STK Push Initiated Successfully!\nCheckoutRequestID: ${response.data.data.CheckoutRequestID}\nCheck your phone for the payment prompt.`);
      } else {
        setError(`STK Push failed: ${response.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('QRScanner error:', err.response?.data || err.message);
      setError(
        `Error: ${err.response?.data?.error || 'Failed to initiate STK push'}`
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-4">M-Pesa QR Payment</h2>
          <p className="text-gray-600">Please login to access the payment system</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">QR Payment Scanner</h2>
        
        {user && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">Logged in as: {user.email}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-medium">Phone Number</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="254708374149"
              pattern="^254[0-9]{9}$"
              required
            />
            <small className="text-gray-500">For sandbox testing, use: 254708374149</small>
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Amount (KSH)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="1"
              min="1"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {loading ? 'Processing...' : 'Initiate M-Pesa Payment'}
          </button>

          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 whitespace-pre-line">{message}</p>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default QRScanner;