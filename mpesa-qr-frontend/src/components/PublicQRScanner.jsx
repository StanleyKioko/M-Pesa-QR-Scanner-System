import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  AlertCircle,
  CheckCircle,
  Camera,
  CameraOff,
  RefreshCw,
  Smartphone,
  Phone,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import { Label } from './ui/Label';

const PublicQRScanner = () => {
  const [scanning, setScanning] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cameraPermission, setCameraPermission] = useState(null);
  const [html5QrCode, setHtml5QrCode] = useState(null);

  useEffect(() => {
    // Initialize the scanner
    const qrCodeScanner = new Html5Qrcode('qr-reader');
    setHtml5QrCode(qrCodeScanner);

    // Cleanup on component unmount
    return () => {
      if (qrCodeScanner && qrCodeScanner.isScanning) {
        qrCodeScanner.stop().catch(err => console.error('Error stopping scanner:', err));
      }
    };
  }, []);

  const startScanner = async () => {
    setScanning(true);
    setError('');

    try {
      setCameraPermission('requesting');
      
      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        onScanSuccess,
        onScanFailure
      );
      
      setCameraPermission('granted');
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Failed to access camera. Please check permissions and try again.');
      setScanning(false);
      setCameraPermission('denied');
    }
  };

  const stopScanner = async () => {
    if (html5QrCode && html5QrCode.isScanning) {
      try {
        await html5QrCode.stop();
        console.log('Scanner stopped');
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setScanning(false);
  };

  const onScanSuccess = (decodedText) => {
    console.log('QR Code detected:', decodedText);
    stopScanner();
    
    try {
      // Parse the QR data
      const parsedData = JSON.parse(decodedText);
      setQrData(parsedData);
      
      // Auto-extract phone number if available (for development)
      if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_TEST_PHONE) {
        setPhoneNumber(process.env.REACT_APP_TEST_PHONE);
      }
      
      // Check if this is a dynamic amount QR code (customer enters amount)
      if (parsedData.dynamicAmount) {
        // Clear amount field to ensure customer enters it
        setAmount('');
      } else if (parsedData.amount) {
        // If not a dynamic QR code and has a fixed amount, set it
        setAmount(parsedData.amount.toString());
      }
      
    } catch (err) {
      console.error('Error parsing QR data:', err);
      setError('Invalid QR code format. Please scan a valid M-Pesa QR code.');
      setQrData(null);
    }
  };

  const onScanFailure = (error) => {
    // We don't need to do anything here, this is called when a frame doesn't contain a QR code
    // console.log('No QR code found in this frame');
  };

  const resetScanner = () => {
    stopScanner();
    setQrData(null);
    setPhoneNumber('');
    setAmount('');
    setError('');
    setSuccess('');
  };

  const processPayment = async () => {
    if (!qrData) {
      setError('Please scan a QR code first');
      return;
    }

    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    // For dynamic QR codes, amount must be entered by customer
    if (!amount) {
      setError('Please enter payment amount');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const paymentAmount = amount;
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/daraja/customer-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber,
          amount: parseFloat(paymentAmount),
          merchantId: qrData.merchantId,
          businessName: qrData.businessName,
          description: qrData.description || 'Payment',
          reference: qrData.reference,
          qrReference: qrData.qrReference
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccess(`Payment request of KSH ${paymentAmount} sent to ${phoneNumber}. Please check your phone and enter M-Pesa PIN to complete payment.`);
      } else {
        setError(result.message || 'Payment failed. Please try again.');
      }
    } catch (err) {
      console.error('Payment Error:', err);
      setError('Failed to process payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            M-Pesa QR Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scanner Section */}
          {!qrData ? (
            <div className="space-y-4">
              <div 
                id="qr-reader" 
                className={`bg-gray-100 rounded-lg overflow-hidden ${!scanning ? 'h-48 flex items-center justify-center' : ''}`}
              >
                {!scanning && (
                  <div className="text-center p-6">
                    <Camera className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-500">Camera will appear here</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {!scanning ? (
                  <Button
                    onClick={startScanner}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Start Scanner
                  </Button>
                ) : (
                  <Button
                    onClick={stopScanner}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <CameraOff className="w-4 h-4" />
                    Stop Scanner
                  </Button>
                )}
              </div>

              {cameraPermission === 'denied' && (
                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                  <p className="text-yellow-700 text-sm">
                    Camera access denied. Please check your browser permissions and try again.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Payment Form after QR scan */
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                <h3 className="font-medium text-blue-800 mb-1">Payment Details</h3>
                <p className="text-sm text-blue-700">
                  Business: <span className="font-semibold">{qrData.businessName || 'Unknown Merchant'}</span>
                </p>
                {qrData.description && (
                  <p className="text-sm text-blue-700">
                    Description: <span className="font-semibold">{qrData.description}</span>
                  </p>
                )}
                {qrData.reference && (
                  <p className="text-sm text-blue-700">
                    Reference: <span className="font-semibold">{qrData.reference}</span>
                  </p>
                )}
                {!qrData.dynamicAmount && qrData.amount && (
                  <p className="text-sm text-blue-700">
                    Amount: <span className="font-semibold">KSH {qrData.amount}</span>
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number (M-Pesa)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter your phone number"
                      className="pl-10"
                      maxLength={12}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Format: 254XXXXXXXXX</p>
                </div>

                {/* Always show the amount field for dynamic QR codes */}
                <div className="space-y-2">
                  <Label htmlFor="amount">
                    {qrData.dynamicAmount ? 'Enter Amount (KSH)' : 'Amount (KSH)'}
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="pl-10"
                      type="number"
                      // Only make it readonly if it's not a dynamic amount QR
                      readOnly={!qrData.dynamicAmount && qrData.amount}
                    />
                  </div>
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-green-700 text-sm">{success}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={processPayment}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4" />
                      Pay with M-Pesa
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={resetScanner}
                  variant="outline"
                  disabled={loading}
                  className="flex items-center justify-center"
                >
                  <QrCode className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicQRScanner;