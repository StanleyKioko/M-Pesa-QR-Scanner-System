import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button'; // Changed to default import
import Input from './ui/Input';   // Changed to default import
import { Label } from './ui/Label'; // Keep named import
import { 
  User, 
  DollarSign, 
  Phone, 
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL, MPESA_CONFIG } from '../utility/constants';


const PaymentLink = () => {
  const [searchParams] = useSearchParams();
  const [qrData, setQrData] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(MPESA_CONFIG.TEST_PHONE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle');

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decoded = decodeURIComponent(data);
        const parsed = JSON.parse(decoded);
        setQrData(parsed);
      } catch (error) {
        setError('Invalid payment link');
      }
    } else {
      setError('No payment data found');
    }
  }, [searchParams]);

  const validatePhoneNumber = (phone) => {
    return /^254\d{9}$/.test(phone);
  };

  const handlePayment = async () => {
    if (!qrData) {
      setError('No payment data available');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number (254XXXXXXXXX)');
      return;
    }

    setLoading(true);
    setError('');
    setPaymentStatus('processing');

    try {
      const paymentRequest = {
        phoneNumber: phoneNumber.trim(),
        amount: qrData.amount,
        qrData: {
          merchantId: qrData.merchantId,
          businessName: qrData.businessName,
          businessShortCode: qrData.businessShortCode
        }
      };

      const response = await axios.post(
        `${API_BASE_URL}/daraja/customer-payment`,
        paymentRequest,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      if (response.data.success) {
        setSuccess(true);
        setPaymentStatus('success');
        setError('');
      } else {
        setError(response.data.error || 'Payment failed');
        setPaymentStatus('failed');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.response?.data?.error || 'Payment failed. Please try again.');
      setPaymentStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  if (error && !qrData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Payment Link</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!qrData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">M-Pesa Payment</h1>
          <p className="text-gray-600">Complete your payment below</p>
        </div>

        {/* Merchant Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Payment To
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Business:</span>
                <span className="font-semibold">{qrData.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="text-2xl font-bold text-green-600">
                  KSH {qrData.amount}
                </span>
              </div>
              {qrData.description && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Description:</span>
                  <span>{qrData.description}</span>
                </div>
              )}
              {qrData.reference && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Reference:</span>
                  <span className="font-mono text-sm">{qrData.reference}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        {!success ? (
          <Card>
            <CardHeader>
              <CardTitle>Enter Your Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Your M-Pesa Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="phone"
                    placeholder="254XXXXXXXXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  STK push will be sent to this number
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <Button 
                onClick={handlePayment}
                disabled={loading || !phoneNumber}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Pay KSH {qrData.amount}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          /* Success State */
          <Card className="border-green-500 bg-green-50">
            <CardContent className="p-6 text-center">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-green-900 mb-2">
                Payment Initiated!
              </h2>
              <p className="text-green-800 mb-4">
                Please check your phone for the M-Pesa STK push and enter your PIN to complete the payment.
              </p>
              <div className="bg-white p-3 rounded border">
                <p className="text-sm text-gray-600">
                  Amount: <span className="font-semibold">KSH {qrData.amount}</span><br/>
                  To: <span className="font-semibold">{qrData.businessName}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Enter your M-Pesa registered phone number</li>
              <li>2. Click "Pay" to initiate the payment</li>
              <li>3. You'll receive an STK push on your phone</li>
              <li>4. Enter your M-Pesa PIN to complete payment</li>
              <li>5. You'll receive a confirmation SMS</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentLink;