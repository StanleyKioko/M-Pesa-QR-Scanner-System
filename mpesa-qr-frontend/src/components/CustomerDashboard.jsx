import { useState } from "react";
import Button from "./ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import Input from "./ui/Input";
import Label from "./ui/Label";
import { 
  Camera, 
  QrCode, 
  ArrowLeft, 
  Phone, 
  DollarSign, 
  User, 
  Home, 
  LogOut, 
  ChevronDown,
  Smartphone,
  CreditCard,
  Shield,
  Zap,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  X,
  Edit3,
  Scan,
  Wallet
} from "lucide-react";
import QRScannerCamera from './QRScannerCamera';
import { parseQRCode, generateSampleQRData, validatePhoneNumber, validateAmount } from '../utility/qrParser';
import { API_BASE_URL, STATUS, MPESA_CONFIG, ERROR_MESSAGES } from '../utility/constants';
import axios from 'axios';

const CustomerDashboard = ({ 
  onPaymentInitiated, 
  onLogout, 
  onNavigateToLanding, 
  onNavigateToScanner, 
  token, 
  userRole = 'customer', 
  getValidToken 
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(MPESA_CONFIG.TEST_PHONE);
  const [amount, setAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNavMenu, setShowNavMenu] = useState(false);

  const handleQRScanSuccess = (qrText, qrResult) => {
    console.log('QR Scanned successfully:', qrText);
    
    const parsedData = parseQRCode(qrText);
    console.log('Parsed QR data:', parsedData);
    
    setQrData(parsedData);
    
    if (parsedData.isValid) {
      setMerchantName(parsedData.merchantName || "QR Merchant");
      setPhoneNumber(parsedData.phoneNumber);
      setAmount(parsedData.amount || "1");
      setIsScanning(false);
      setError("");
    } else {
      setError(ERROR_MESSAGES.INVALID_QR);
    }
  };

  const handleQRScanError = (error) => {
    console.error('QR Scan error:', error);
    setError(ERROR_MESSAGES.QR_SCAN_FAILED);
  };

  const handleTestQR = () => {
    const testQRData = generateSampleQRData();
    console.log('Testing with sample QR:', testQRData);
    handleQRScanSuccess(testQRData, null);
  };

  const handleScanQR = () => {
    setIsScanning(true);
    setError("");
  };

  // Customer payment function (no authentication required)
  const triggerCustomerPayment = async (paymentRequest) => {
    try {
      console.log('Starting CUSTOMER payment request...');
      console.log('Customer payment data:', paymentRequest);
      
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
      
      console.log('Customer payment response received:', response.data);

      if (response.data.success) {
        console.log('Customer payment initiated successfully');
        
        return {
          success: true,
          data: {
            transactionId: response.data.data?.transactionId,
            checkoutRequestID: response.data.data?.CheckoutRequestID,
            merchantRequestID: response.data.data?.MerchantRequestID,
            customerMessage: response.data.data?.CustomerMessage,
            mpesaResponse: response.data.data
          }
        };
      } else {
        console.log('Customer payment failed:', response.data);
        return {
          success: false,
          error: response.data.error || response.data.message || 'Payment failed'
        };
      }
    } catch (err) {
      console.error('Customer payment request error:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        code: err.code
      });
      
      let errorMessage = 'Network error';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your connection and try again.';
      } else if (err.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const handleManualPayment = async () => {
    console.log('Manual payment initiated');
    
    if (!phoneNumber || !amount) {
      setError("Phone number and amount are required");
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
      const paymentData = {
        merchantName: merchantName || "Manual Entry",
        phoneNumber,
        amount: parseFloat(amount),
        timestamp: new Date()
      };

      console.log('Customer mode - triggering STK push to customer phone');
      
      const customerPaymentRequest = {
        phoneNumber: phoneNumber.trim(),
        amount: parseFloat(amount),
        qrData: {
          merchantId: `manual-${Date.now()}`,
          businessName: merchantName || 'Manual Entry Merchant',
          businessShortCode: MPESA_CONFIG.SANDBOX_SHORTCODE
        }
      };

      const result = await triggerCustomerPayment(customerPaymentRequest);

      if (result.success) {
        const enhancedPaymentData = {
          ...paymentData,
          ...result.data,
          status: STATUS.PENDING,
          isCustomerPayment: true
        };
        
        console.log('Customer payment initiated successfully:', enhancedPaymentData);
        if (onPaymentInitiated) {
          onPaymentInitiated(enhancedPaymentData);
        }
      } else {
        console.log('Customer payment failed:', result.error);
        setError(`Payment failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Manual payment error:', err);
      setError(`Payment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQRPayment = async () => {
    console.log('QR payment initiated');
    
    if (!qrData || !qrData.isValid) {
      setError("Invalid QR code data");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const paymentData = {
        merchantName,
        phoneNumber,
        amount: parseFloat(amount),
        timestamp: new Date()
      };

      console.log('Customer QR payment - triggering STK push to customer phone');
      
      const customerPaymentRequest = {
        phoneNumber: phoneNumber.trim(),
        amount: parseFloat(amount),
        qrData: {
          merchantId: qrData.merchantId || `qr-${Date.now()}`,
          businessName: qrData.merchantName || merchantName || 'QR Merchant',
          businessShortCode: qrData.businessShortCode || MPESA_CONFIG.SANDBOX_SHORTCODE
        }
      };

      const result = await triggerCustomerPayment(customerPaymentRequest);

      if (result.success) {
        const enhancedPaymentData = {
          ...paymentData,
          ...result.data,
          status: STATUS.PENDING,
          isCustomerPayment: true
        };
        
        console.log('Customer QR payment initiated successfully:', enhancedPaymentData);
        if (onPaymentInitiated) {
          onPaymentInitiated(enhancedPaymentData);
        }
      } else {
        console.log('Customer QR payment failed:', result.error);
        setError(`Payment failed: ${result.error}`);
      }
    } catch (err) {
      console.error('QR payment error:', err);
      setError(`Payment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testBackendConnection = async () => {
    try {
      console.log('Testing backend connection...');
      const response = await axios.get(`${API_BASE_URL}/health`);
      
      console.log('Backend connection successful:', response.data);
      setError(`Backend connection successful! Server is running.`);
    } catch (err) {
      console.error('Backend connection failed:', err);
      setError(`Backend connection failed: ${err.message}`);
    }
  };

  const testSTKPush = async () => {
    setLoading(true);
    setError("");

    try {
      const testPayload = {
        phoneNumber: MPESA_CONFIG.TEST_PHONE,
        amount: 1,
        qrData: {
          merchantId: `test-${Date.now()}`,
          businessName: 'Test Merchant',
          businessShortCode: MPESA_CONFIG.SANDBOX_SHORTCODE
        }
      };
      
      const result = await triggerCustomerPayment(testPayload);
      
      if (result.success) {
        console.log('STK Push test successful:', result);
        setError(`STK Push test successful! CheckoutRequestID: ${result.data.checkoutRequestID}`);
      } else {
        console.log('STK Push test failed:', result.error);
        setError(`STK Push test failed: ${result.error}`);
      }
    } catch (err) {
      console.error('STK Push test error:', err);
      setError(`STK Push test error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg">
        <div className="px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">M-Pesa Pay</h1>
                <p className="text-green-100 text-sm">Scan & Pay Instantly</p>
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNavMenu(!showNavMenu)}
                className="text-white hover:bg-white/20 border border-white/30"
              >
                <ChevronDown className="w-4 h-4 mr-2" />
                Menu
              </Button>
              
              {showNavMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl py-2 z-50 border">
                  <button
                    onClick={() => {
                      setShowNavMenu(false);
                      onNavigateToLanding();
                    }}
                    className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                  >
                    <Home className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium">Back to Home</span>
                  </button>
                  
                  {onLogout && (
                    <button
                      onClick={() => {
                        setShowNavMenu(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-3 text-left text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-medium">Logout</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Status Badge */}
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-2">
              <div className="bg-green-500 p-1 rounded-full">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-green-800">Customer Mode Active</span>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50 shadow-sm animate-in fade-in duration-300">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-red-700 text-sm leading-relaxed">{error}</p>
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

        {/* Scanner Mode */}
        {isScanning ? (
          <Card className="shadow-lg border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Scan className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Scanning QR Code</CardTitle>
                  <CardDescription className="text-blue-100">
                    Point your camera at a merchant QR code
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="bg-gray-100 rounded-xl p-4 mb-4">
                <QRScannerCamera
                  onSuccess={handleQRScanSuccess}
                  onError={handleQRScanError}
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => setIsScanning(false)}
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Stop Scanning
              </Button>
            </CardContent>
          </Card>
        ) : !manualEntry ? (
          /* Main Interface */
          <>
            {/* QR Code Detection Result */}
            {qrData && qrData.isValid ? (
              <Card className="border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 shadow-lg animate-in slide-in-from-bottom duration-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500 p-2 rounded-full">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-green-800 text-lg">QR Code Detected!</CardTitle>
                      <CardDescription className="text-green-600">
                        Payment details ready for confirmation
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 mb-6">
                    <div className="bg-white rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-100 p-2 rounded-full">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Merchant</p>
                          <p className="font-semibold text-gray-900">{merchantName}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-100 p-2 rounded-full">
                          <Phone className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Your Number</p>
                          <p className="font-mono text-sm text-gray-900">{phoneNumber}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full">
                          <DollarSign className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide">Amount</p>
                          <p className="text-2xl font-bold text-green-600">KSH {amount}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleQRPayment} 
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 rounded-xl font-semibold text-lg shadow-lg"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        Pay KSH {amount}
                      </div>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              /* Welcome Card */
              <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
                <CardContent className="p-8 text-center">
                  <div className="mb-6">
                    <div className="bg-gradient-to-r from-green-500 to-blue-500 p-4 rounded-full w-fit mx-auto mb-4">
                      <QrCode className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to Pay?</h2>
                    <p className="text-gray-600 leading-relaxed">
                      Scan any merchant QR code or enter payment details manually for instant M-Pesa payments
                    </p>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-3">
                    <Button 
                      onClick={handleScanQR} 
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 rounded-xl font-semibold shadow-lg"
                      disabled={loading}
                    >
                      <div className="flex items-center gap-3">
                        <Camera className="w-5 h-5" />
                        <span className="text-lg">Start Scanning</span>
                      </div>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={() => setManualEntry(true)}
                      className="w-full py-4 rounded-xl font-medium border-2 hover:bg-gray-50"
                      disabled={loading}
                    >
                      <div className="flex items-center gap-3">
                        <Edit3 className="w-5 h-5" />
                        <span>Enter Details Manually</span>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Features Grid */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="text-center p-4 bg-gradient-to-b from-blue-50 to-blue-100 border-blue-200">
                <div className="bg-blue-500 p-2 rounded-full w-fit mx-auto mb-2">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-semibold text-blue-800">Instant</p>
                <p className="text-xs text-blue-600">Payments</p>
              </Card>
              
              <Card className="text-center p-4 bg-gradient-to-b from-green-50 to-green-100 border-green-200">
                <div className="bg-green-500 p-2 rounded-full w-fit mx-auto mb-2">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-semibold text-green-800">Secure</p>
                <p className="text-xs text-green-600">M-Pesa</p>
              </Card>
              
              <Card className="text-center p-4 bg-gradient-to-b from-purple-50 to-purple-100 border-purple-200">
                <div className="bg-purple-500 p-2 rounded-full w-fit mx-auto mb-2">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-semibold text-purple-800">Easy</p>
                <p className="text-xs text-purple-600">QR Scan</p>
              </Card>
            </div>

            {/* Test Options */}
            <Card className="bg-gray-50 border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-700">Test Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  onClick={handleTestQR}
                  disabled={loading}
                  className="w-full text-sm"
                >
                  Try with Sample QR Code
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          /* Manual Entry Form */
          <Card className="shadow-lg border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Manual Payment</CardTitle>
                  <CardDescription className="text-blue-100">
                    Enter payment details manually
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="merchant" className="text-sm font-semibold text-gray-700">
                  Merchant Name (Optional)
                </Label>
                <Input
                  id="merchant"
                  placeholder="e.g. Supermarket ABC"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  disabled={loading}
                  className="rounded-xl border-gray-300 py-3"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold text-gray-700">
                  Your Phone Number
                </Label>
                <Input
                  id="phone"
                  placeholder="254XXXXXXXXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading}
                  className="rounded-xl border-gray-300 py-3 font-mono"
                />
                <p className="text-xs text-gray-500">Enter your M-Pesa registered number</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm font-semibold text-gray-700">
                  Amount (KSH)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                  className="rounded-xl border-gray-300 py-3 text-lg font-semibold"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setManualEntry(false)}
                  className="flex-1 py-3 rounded-xl"
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={handleManualPayment}
                  disabled={!phoneNumber || !amount || loading}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 py-3 rounded-xl font-semibold"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Pay Now
                    </div>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* How it Works */}
        <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-indigo-800 text-lg flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              How it Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-sm text-indigo-700">Scan merchant QR code or enter details</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-sm text-indigo-700">Confirm payment amount and details</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-sm text-indigo-700">Enter your M-Pesa PIN to complete</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerDashboard;