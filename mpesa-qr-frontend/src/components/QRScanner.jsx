import { useState } from 'react';
import axios from 'axios';
import QRScannerCamera from './QRScannerCamera';
import { parseQRCode, generateSampleQRData, validatePhoneNumber, validateAmount } from '../utility/qrParser';

function QRScanner({ token, user }) {
  const [phoneNumber, setPhoneNumber] = useState('254708374149');
  const [amount, setAmount] = useState('1');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanMode, setScanMode] = useState('manual'); // 'manual' or 'camera'
  const [qrData, setQrData] = useState(null);

  const handleQRScanSuccess = (qrText, qrResult) => {
    console.log('QR Scanned successfully:', qrText);
    
    const parsedData = parseQRCode(qrText);
    console.log('Parsed QR data:', parsedData);
    
    setQrData(parsedData);
    
    if (parsedData.isValid) {
      // Auto-fill form with scanned data
      setPhoneNumber(parsedData.phoneNumber);
      setAmount(parsedData.amount || '1');
      setReference(parsedData.reference || `QR_${Date.now()}`);
      setDescription(parsedData.description || 'QR Payment');
      setMessage(`QR Code scanned successfully! Payment details loaded.`);
      setError('');
      setScanMode('manual'); // Switch back to manual mode
    } else {
      setError(`Invalid QR code format. Raw data: ${parsedData.rawData || qrText}`);
    }
  };

  const handleQRScanError = (error) => {
    console.error('QR Scan error:', error);
    setError(`QR Scan failed: ${error}`);
  };

  const handleTestQR = () => {
    const testQRData = generateSampleQRData();
    console.log('Testing with sample QR:', testQRData);
    handleQRScanSuccess(testQRData, null);
  };

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

    // Validate inputs
    if (!phoneNumber || !amount) {
      setError('Phone number and amount are required');
      setLoading(false);
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError('Invalid phone number format. Use 254XXXXXXXXX');
      setLoading(false);
      return;
    }

    if (!validateAmount(amount)) {
      setError('Invalid amount. Must be a positive number');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        phoneNumber: phoneNumber.trim(),
        amount: parseFloat(amount),
        reference: reference || `QR_${Date.now()}`,
        description: description || 'QR Payment'
      };

      console.log('Sending payment request:', payload);

      const response = await axios.post('http://localhost:3000/daraja/scan-qr', payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      
      console.log('STK Push Response:', response.data);
      
      if (response.data.status === 'success') {
        setMessage(
          `STK Push Initiated Successfully!\n` +
          `CheckoutRequestID: ${response.data.data.CheckoutRequestID}\n` +
          `Amount: KSH ${amount}\n` +
          `Phone: ${phoneNumber}\n` +
          `Reference: ${reference}\n` +
          `Check your phone for the payment prompt.`
        );
        
        // Clear form after successful request
        if (!qrData) { // Only clear if not from QR scan
          setPhoneNumber('254708374149');
          setAmount('1');
          setReference('');
          setDescription('');
        }
      } else {
        setError(`STK Push failed: ${response.data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Payment request error:', err.response?.data || err.message);
      setError(
        `Error: ${err.response?.data?.error || 'Failed to initiate STK push'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setPhoneNumber('254708374149');
    setAmount('1');
    setReference('');
    setDescription('');
    setMessage('');
    setError('');
    setQrData(null);
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
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">QR Payment Scanner</h2>
        
        {user && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">Logged in as: {user.email}</p>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="mb-6">
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => setScanMode('manual')}
              className={`px-4 py-2 rounded-lg font-medium ${
                scanMode === 'manual' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setScanMode('camera')}
              className={`px-4 py-2 rounded-lg font-medium ${
                scanMode === 'camera' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Scan QR Code
            </button>
            <button
              onClick={handleTestQR}
              className="px-4 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700"
            >
              Test QR
            </button>
          </div>
        </div>

        {/* QR Scanner */}
        {scanMode === 'camera' && (
          <div className="mb-6 border rounded-lg p-4">
            <QRScannerCamera 
              onScanSuccess={handleQRScanSuccess}
              onScanError={handleQRScanError}
            />
          </div>
        )}

        {/* QR Data Display */}
        {qrData && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="font-medium text-green-800 mb-2">QR Code Data:</h4>
            <div className="text-sm text-green-700">
              <p><strong>Type:</strong> {qrData.type}</p>
              <p><strong>Phone:</strong> {qrData.phoneNumber}</p>
              <p><strong>Amount:</strong> {qrData.amount}</p>
              <p><strong>Reference:</strong> {qrData.reference}</p>
              <p><strong>Valid:</strong> {qrData.isValid ? 'Yes' : 'No'}</p>
            </div>
          </div>
        )}

        {/* Payment Form */}
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
            <small className="text-gray-500">Format: 254XXXXXXXXX (12 digits)</small>
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
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Reference (Optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Payment reference"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Payment description"
            />
          </div>

          <div className="flex space-x-4">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Processing...' : 'Initiate M-Pesa Payment'}
            </button>
            <button 
              type="button"
              onClick={clearForm}
              className="px-6 bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600 font-medium"
            >
              Clear
            </button>
          </div>

          {message && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 whitespace-pre-line">{message}</p>
            </div>
          )}
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </form>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">QR Code Formats Supported:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• JSON: {`{"phone":"254708374149","amount":"100","reference":"REF123"}`}</li>
            <li>• URL: https://pay.example.com?phone=254708374149&amount=100</li>
            <li>• Custom: 254708374149:100:REF123:Description</li>
            <li>• Phone only: 254708374149</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default QRScanner;