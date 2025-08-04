import { useState } from 'react';
import axios from 'axios';

function QRScanner({ token }) {
  const [phoneNumber, setPhoneNumber] = useState('254708374149'); // Pre-fill with test number
  const [amount, setAmount] = useState('1');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    // Validate inputs
    if (!phoneNumber || !amount) {
      setError('Phone number and amount are required');
      return;
    }

    // Log the request payload
    console.log('Sending STK Push request:', { phoneNumber, amount });

    try {
      const response = await axios.post('http://localhost:3000/daraja/scan-qr', {
        phoneNumber,
        amount: parseFloat(amount),
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('STK Push Response:', response.data);
      
      if (response.data.status === 'success') {
        setMessage(`STK Push Initiated Successfully! CheckoutRequestID: ${response.data.data.CheckoutRequestID}`);
      } else {
        setError(`STK Push failed: ${response.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('QRScanner error:', err.response?.data || err.message);
      setError(
        `Error: ${err.response?.data?.error || 'Failed to initiate STK push'}\n` +
        `Details: ${JSON.stringify(err.response?.data?.details || {})}\n` +
        `Status: ${err.response?.status || 'N/A'}`
      );
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">QR Scanner</h2>
      <form onSubmit={handleSubmit} className="max-w-md">
        <div className="mb-4">
          <label className="block text-gray-700">Phone Number (254XXXXXXXXX)</label>
          <input
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="254708374149"
            pattern="^254[0-9]{9}$"
            required
          />
          <small className="text-gray-500">For sandbox testing, use: 254708374149</small>
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="1"
            min="1"
            required
          />
        </div>
        <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
          Initiate Payment
        </button>
        {message && <p className="mt-4 text-green-600 whitespace-pre-line">{message}</p>}
        {error && <p className="mt-4 text-red-600 whitespace-pre-line">{error}</p>}
      </form>
    </div>
  );
}

export default QRScanner;