import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Label from './ui/Label';
import { 
  Camera, 
  QrCode, 
  ArrowLeft, 
  Phone, 
  DollarSign, 
  User, 
  Home, 
  ChevronDown,
  Smartphone,
  Shield,
  Zap,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  X,
  Lock,
  CreditCard,
  Scan
} from "lucide-react";
import { parseQRCode, generateSampleQRData, validatePhoneNumber, validateAmount } from '../utility/qrParser';
import { API_BASE_URL, STATUS, MPESA_CONFIG, ERROR_MESSAGES } from '../utility/constants';
import axios from 'axios';
import jsQR from 'jsqr';

const QRPaymentScanner = ({ onPaymentInitiated, onNavigateToLanding }) => {
  // Camera and QR states
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [stream, setStream] = useState(null);
  
  // Payment states
  const [phoneNumber, setPhoneNumber] = useState(MPESA_CONFIG.TEST_PHONE);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [paymentStep, setPaymentStep] = useState('scan'); // 'scan', 'details', 'confirm'

  // Camera setup
  const startCamera = async () => {
    try {
      setError("");
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        setStream(mediaStream);
        setScannerReady(true);
        
        // Start QR scanning
        scanForQR();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please allow camera permissions and try again.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setScannerReady(false);
    setIsScanning(false);
  };

  const scanForQR = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const scan = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA && scannerReady) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          console.log('QR Code detected:', code.data);
          handleQRDetected(code.data);
          return;
        }
      }
      
      if (scannerReady) {
        requestAnimationFrame(scan);
      }
    };
    
    scan();
  };

  const handleQRDetected = (qrText) => {
    console.log('Processing QR:', qrText);
    
    const parsedData = parseQRCode(qrText);
    console.log('Parsed QR data:', parsedData);
    
    if (parsedData.isValid) {
      setQrData(parsedData);
      if (parsedData.amount) {
        setAmount(parsedData.amount.toString());
      }
      stopCamera();
      setPaymentStep('details');
      setError("");
    } else {
      setError("Invalid QR code. Please scan a valid merchant payment QR.");
    }
  };

  const handleStartOver = () => {
    setQrData(null);
    setAmount("");
    setError("");
    setPaymentStep('scan');
  };

  const handleUseCamera = () => {
    setIsScanning(true);
    setPaymentStep('scan');
    startCamera();
  };

  const handleTestQR = () => {
    const testQRData = generateSampleQRData();
    console.log('Testing with sample QR:', testQRData);
    const parsedData = parseQRCode(testQRData);
    setQrData(parsedData);
    if (parsedData.amount) {
      setAmount(parsedData.amount.toString());
    }
    setPaymentStep('details');
  };

  // Customer payment function
  const triggerCustomerPayment = async (paymentRequest) => {
    try {
      console.log('Starting customer payment request...');
      
      const response = await axios.post(
        `${API_BASE_URL}/daraja/customer-payment`,
        paymentRequest,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      );
      
      if (response.data.success) {
        return {
          success: true,
          data: {
            transactionId: response.data.data?.transactionId,
            checkoutRequestID: response.data.data?.CheckoutRequestID,
            merchantRequestID: response.data.data?.MerchantRequestID,
            customerMessage: response.data.data?.CustomerMessage,
            instructions: response.data.data?.instructions
          }
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Payment failed'
        };
      }
    } catch (err) {
      console.error('Payment request error:', err);
      
      let errorMessage = 'Network error';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const handleConfirmPayment = async () => {
    if (!qrData || !phoneNumber || !amount) {
      setError("All fields are required");
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError(ERROR_MESSAGES.INVALID_PHONE);
      return;
    }

    if (!validateAmount(amount)) {
      setError(ERROR_MESSAGES.INVALID_AMOUNT);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const paymentRequest = {
        phoneNumber: phoneNumber.trim(),
        amount: parseFloat(amount),
        qrData: {
          merchantId: qrData.merchantId || `qr-${Date.now()}`,
          businessName: qrData.merchantName || qrData.businessName || 'QR Merchant',
          businessShortCode: qrData.businessShortCode || MPESA_CONFIG.SANDBOX_SHORTCODE
        }
      };

      const result = await triggerCustomerPayment(paymentRequest);

      if (result.success) {
        const paymentData = {
          merchantName: qrData.merchantName || qrData.businessName || "QR Merchant",
          phoneNumber,
          amount: parseFloat(amount),
          timestamp: new Date(),
          ...result.data,
          status: STATUS.PENDING,
          isCustomerPayment: true
        };
        
        console.log('Payment initiated successfully:', paymentData);
        if (onPaymentInitiated) {
          onPaymentInitiated(paymentData);
        }
      } else {
        setError(`Payment failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(`Payment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getMerchantDisplayName = () => {
    if (qrData?.merchantName) return qrData.merchantName;
    if (qrData?.businessName) return qrData.businessName;
    return "QR Merchant";
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg">
        <div className="px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">M-Pesa QR Pay</h1>
                <p className="text-green-100 text-sm">Scan • Enter PIN • Pay</p>
              </div>
            </div>
            
            {/* Menu */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNavMenu(!showNavMenu)}
                className="text-white hover:bg-white/20"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              
              {showNavMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl py-2 z-50">
                  <button
                    onClick={() => {
                      setShowNavMenu(false);
                      onNavigateToLanding();
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <Home className="w-4 h-4" />
                    <span>Back to Home</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowNavMenu(false);
                      handleStartOver();
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Start Over</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Progress Steps */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${
                paymentStep === 'scan' ? 'text-blue-600' : qrData ? 'text-green-600' : 'text-gray-400'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  paymentStep === 'scan' ? 'bg-blue-600 text-white' : qrData ? 'bg-green-600 text-white' : 'bg-gray-300'
                }`}>1</div>
                <span className="text-sm font-medium">Scan</span>
              </div>
              
              <div className="flex-1 h-px bg-gray-300"></div>
              
              <div className={`flex items-center gap-2 ${
                paymentStep === 'details' ? 'text-blue-600' : paymentStep === 'confirm' ? 'text-green-600' : 'text-gray-400'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  paymentStep === 'details' ? 'bg-blue-600 text-white' : paymentStep === 'confirm' ? 'bg-green-600 text-white' : 'bg-gray-300'
                }`}>2</div>
                <span className="text-sm font-medium">Details</span>
              </div>
              
              <div className="flex-1 h-px bg-gray-300"></div>
              
              <div className={`flex items-center gap-2 ${
                paymentStep === 'confirm' ? 'text-blue-600' : 'text-gray-400'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  paymentStep === 'confirm' ? 'bg-blue-600 text-white' : 'bg-gray-300'
                }`}>3</div>
                <span className="text-sm font-medium">Pay</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setError("")}
                  className="text-red-600 hover:bg-red-100 p-1"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: QR Scanning */}
        {paymentStep === 'scan' && (
          <>
            {isScanning && scannerReady ? (
              <Card className="shadow-lg">
                <CardHeader className="bg-blue-600 text-white">
                  <CardTitle className="flex items-center gap-2">
                    <Scan className="w-5 h-5" />
                    Scanning QR Code
                  </CardTitle>
                  <CardDescription className="text-blue-100">
                    Point camera at merchant QR code
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="relative">
                    <video
                      ref={videoRef}
                      className="w-full h-64 object-cover bg-black"
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Scanning overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="border-2 border-white border-dashed w-48 h-48 rounded-lg flex items-center justify-center">
                        <QrCode className="w-12 h-12 text-white opacity-50" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <Button 
                      variant="outline" 
                      onClick={stopCamera}
                      className="w-full"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Stop Scanning
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Welcome Screen */
              <Card className="shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="mb-6">
                    <div className="bg-gradient-to-r from-green-500 to-blue-500 p-4 rounded-full w-fit mx-auto mb-4">
                      <QrCode className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Ready to Pay?</h2>
                    <p className="text-gray-600">
                      Scan any merchant QR code for instant M-Pesa payments
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button 
                      onClick={handleUseCamera} 
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 py-4 text-lg font-semibold"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Start Camera Scanning
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={handleTestQR}
                      className="w-full py-3"
                    >
                      Try Sample QR Code
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Features */}
            {!isScanning && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="text-center p-4 bg-blue-50">
                    <Zap className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-blue-800">Instant</p>
                  </Card>
                  <Card className="text-center p-4 bg-green-50">
                    <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-green-800">Secure</p>
                  </Card>
                  <Card className="text-center p-4 bg-purple-50">
                    <Smartphone className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-purple-800">Easy</p>
                  </Card>
                </div>

                {/* Instructions */}
                <Card className="bg-indigo-50">
                  <CardHeader>
                    <CardTitle className="text-indigo-800 flex items-center gap-2">
                      <QrCode className="w-5 h-5" />
                      How it Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</div>
                      <span className="text-sm text-indigo-700">Scan merchant QR code</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                      <span className="text-sm text-indigo-700">Enter phone number and amount</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                      <span className="text-sm text-indigo-700">Enter M-Pesa PIN on your phone</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">4</div>
                      <span className="text-sm text-indigo-700">Get instant confirmation</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* Step 2: Payment Details */}
        {paymentStep === 'details' && qrData && (
          <Card className="shadow-lg">
            <CardHeader className="bg-green-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                QR Code Detected!
              </CardTitle>
              <CardDescription className="text-green-100">
                Enter payment details below
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Merchant Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Paying To</p>
                    <p className="font-semibold">{getMerchantDisplayName()}</p>
                  </div>
                </div>
              </div>

              {/* Phone Input */}
              <div className="space-y-2">
                <Label htmlFor="phone">Your Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="254XXXXXXXXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading}
                  className="font-mono"
                />
                <p className="text-xs text-gray-500">M-Pesa registered number</p>
              </div>
              
              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (KSH)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                  className="text-lg font-semibold"
                />
                {qrData.amount && (
                  <p className="text-xs text-blue-600">
                    Suggested: KSH {qrData.amount}
                    <button 
                      onClick={() => setAmount(qrData.amount.toString())}
                      className="ml-2 underline hover:no-underline"
                    >
                      Use this
                    </button>
                  </p>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={handleStartOver}
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={() => setPaymentStep('confirm')}
                  disabled={!phoneNumber || !amount || loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Payment Confirmation */}
        {paymentStep === 'confirm' && qrData && (
          <Card className="shadow-lg">
            <CardHeader className="bg-purple-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Confirm Payment
              </CardTitle>
              <CardDescription className="text-purple-100">
                Review details before proceeding
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Payment Summary */}
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Paying To:</span>
                    <span className="font-semibold">{getMerchantDisplayName()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Your Number:</span>
                    <span className="font-mono text-sm">{phoneNumber}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="text-2xl font-bold text-green-600">KSH {amount}</span>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <Card className="bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Smartphone className="w-5 h-5 text-blue-600 mt-1" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-2">What happens next:</h4>
                      <ol className="text-sm text-blue-800 space-y-1">
                        <li>📱 You'll get M-Pesa notification on your phone</li>
                        <li>🔐 Enter your M-Pesa PIN to confirm</li>
                        <li>✅ Get instant payment confirmation</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Final Actions */}
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setPaymentStep('details')}
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  onClick={handleConfirmPayment}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-lg font-semibold"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      Pay Now
                    </div>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QRPaymentScanner;