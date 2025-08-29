import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Button from './ui/Button';
import Input from './ui/Input';
import { AlertCircle, CheckCircle } from 'lucide-react';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const PayPrompt = () => {
  const query = useQuery();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [dynamicAmount, setDynamicAmount] = useState(true);

  // Extract QR data from query params
  const qrData = {};
  for (const [key, value] of query.entries()) {
    qrData[key] = value;
  }

  useEffect(() => {
    setDynamicAmount(qrData.dynamicAmount === 'true');
  }, [qrData.dynamicAmount]);

  const handlePay = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!phoneNumber) {
      setError('Please enter your phone number.');
      setLoading(false);
      return;
    }
    if (dynamicAmount && (!amount || isNaN(amount) || Number(amount) <= 0)) {
      setError('Please enter a valid amount.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/daraja/customer-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          amount: dynamicAmount ? amount : qrData.amount,
          qrData
        })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSuccess('STK Push sent! Check your phone to complete the payment.');
      } else {
        setError(result.message || result.error || 'Failed to initiate payment.');
      }
    } catch (err) {
      setError('Failed to initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Build M-Pesa app deep link
  const mpesaAppUrl = `mpesa://paybill?business=${qrData.businessShortCode}&amount=${amount || ''}&account=${qrData.reference || ''}`;

  return (
    <div>
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
          <h2 className="text-xl font-bold mb-2 text-center">
            Pay to {qrData.businessName || 'Merchant'}
          </h2>
          <p className="text-center text-gray-600 mb-4">
            {qrData.description || 'Payment'}
          </p>
          <form onSubmit={handlePay} className="space-y-4">
            <div>
              <label className="block mb-1 font-medium">Phone Number</label>
              <Input
                type="tel"
                placeholder="2547XXXXXXXX"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                required
              />
            </div>
            {dynamicAmount && (
              <div>
                <label className="block mb-1 font-medium">Amount (KES)</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  min="1"
                />
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Processing...' : 'Pay with STK Push'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full mt-2"
              onClick={() => {
                window.location.href = mpesaAppUrl;
              }}
            >
              Pay with M-Pesa App
            </Button>
          </form>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-5 h-5" /> {error}
            </div>
          )}
          {success && (
            <div className="mt-4 flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="w-5 h-5" /> {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PayPrompt;