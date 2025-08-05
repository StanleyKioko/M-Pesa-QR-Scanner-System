import { useState } from "react";
import Button from "./ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import Input from "./ui/Input";
import Label from "./ui/Label";
import { Camera, QrCode, ArrowLeft, Phone, DollarSign, User } from "lucide-react";
import QRScannerCamera from './QRScannerCamera';
import { parseQRCode, generateSampleQRData, validatePhoneNumber, validateAmount } from '../utility/qrParser';
import { API_BASE_URL, STATUS, MPESA_CONFIG, ERROR_MESSAGES } from '../utility/constants';
import axios from 'axios';

const QRScanner = ({ onBack, onPaymentInitiated, token, userRole, getValidToken }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(MPESA_CONFIG.TEST_PHONE);
  const [amount, setAmount] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  // Merchant payment function (requires authentication)
  const triggerMerchantPayment = async (paymentRequest) => {
    try {
      console.log('Starting MERCHANT payment request...');
      
      // Get a fresh token if getValidToken function is available
      let validToken = token;
      if (getValidToken) {
        console.log('Getting fresh token...');
        validToken = await getValidToken();
        if (!validToken) {
          throw new Error('Failed to get valid authentication token');
        }
      }
      
      console.log('Token present:', !!validToken);
      console.log('API_BASE_URL:', API_BASE_URL);
      console.log('Merchant payment request data:', paymentRequest);

      // Verify we have a token
      if (!validToken) {
        throw new Error('No authentication token available');
      }

      const response = await axios.post(
        `${API_BASE_URL}/daraja/scan-qr`,
        paymentRequest,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`
          },
          timeout: 60000 // 60 seconds timeout to match backend
        }
      );
      
      console.log('Merchant payment response received:', response.data);

      // Check for successful status in response
      if (response.data.status === 'success') {
        console.log('Merchant payment initiated successfully');
        
        // Extract the correct data structure from backend response
        const backendData = response.data;
        
        return {
          success: true,
          data: {
            transactionId: backendData.transactionId,
            transactionRef: backendData.transactionRef,
            checkoutRequestID: backendData.checkoutRequestID,
            customerMessage: backendData.customerMessage || backendData.data?.CustomerMessage,
            merchantRequestID: backendData.data?.MerchantRequestID,
            // Add additional M-Pesa response data
            mpesaResponse: backendData.data
          }
        };
      } else {
        console.log('Merchant payment failed with response:', response.data);
        return {
          success: false,
          error: response.data.error || response.data.message || 'Payment initiation failed'
        };
      }
    } catch (err) {
      console.error('Merchant payment request error:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        code: err.code
      });
      
      // Enhanced error handling
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
            // No Authorization header - public endpoint
          },
          timeout: 60000 // 60 seconds timeout to match backend
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
            responseDescription: response.data.data?.ResponseDescription,
            mpesaResponse: response.data.data
          }
        };
      } else {
        console.log('Customer payment failed with response:', response.data);
        return {
          success: false,
          error: response.data.message || 'Payment initiation failed'
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
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
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

      // For customer mode - trigger STK push to customer's phone
      if (userRole === 'customer' || !token) {
        console.log('Customer mode - triggering STK push to customer phone');
        
        // FIXED: Add the required qrData field
        const customerPaymentRequest = {
          phoneNumber: phoneNumber.trim(),
          amount: parseFloat(amount),
          qrData: {
            merchantId: `manual-${Date.now()}`, // Generate unique merchant ID
            businessName: merchantName || 'Manual Entry Merchant',
            businessShortCode: MPESA_CONFIG.SANDBOX_SHORTCODE // Use sandbox shortcode
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
          onPaymentInitiated(enhancedPaymentData);
        } else {
          console.log('Customer payment failed:', result.error);
          setError(`Payment failed: ${result.error}`);
        }
        return;
      }

      // For merchant mode - use existing merchant authentication flow
      const paymentRequest = {
        phoneNumber: phoneNumber.trim(),
        amount: parseFloat(amount),
        reference: `MANUAL_${Date.now()}`,
        description: merchantName || 'Manual QR Payment'
      };

      console.log('Merchant mode - calling backend with authentication');
      const result = await triggerMerchantPayment(paymentRequest);

      if (result.success) {
        const enhancedPaymentData = {
          ...paymentData,
          ...result.data,
          status: STATUS.PENDING,
          isMerchantPayment: true
        };
        
        console.log('Merchant payment initiated successfully:', enhancedPaymentData);
        onPaymentInitiated(enhancedPaymentData);
      } else {
        console.log('Merchant payment failed:', result.error);
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

      // For customer mode - trigger STK push to customer's phone
      if (userRole === 'customer' || !token) {
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
          onPaymentInitiated(enhancedPaymentData);
        } else {
          console.log('Customer QR payment failed:', result.error);
          setError(`Payment failed: ${result.error}`);
        }
        return;
      }

      // For merchant mode - use existing merchant authentication flow
      const paymentRequest = {
        phoneNumber: phoneNumber.trim(),
        amount: parseFloat(amount),
        reference: qrData.reference || `QR_${Date.now()}`,
        description: qrData.description || merchantName || 'QR Payment'
      };

      console.log('Merchant QR payment - calling backend with authentication');
      const result = await triggerMerchantPayment(paymentRequest);

      if (result.success) {
        const enhancedPaymentData = {
          ...paymentData,
          ...result.data,
          status: STATUS.PENDING,
          isMerchantPayment: true
        };
        
        console.log('Merchant QR payment initiated successfully:', enhancedPaymentData);
        onPaymentInitiated(enhancedPaymentData);
      } else {
        console.log('Merchant QR payment failed:', result.error);
        setError(`Payment failed: ${result.error}`);
      }
    } catch (err) {
      console.error('QR Payment error:', err);
      setError(`Payment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testBackendConnection = async () => {
    try {
      console.log('Testing backend connection...');
      const response = await axios.get(`${API_BASE_URL}/`, {
        timeout: 5000
      });
      console.log('Backend connection successful:', response.data);
      setError("");
    } catch (err) {
      console.error('Backend connection failed:', err);
      setError(`Backend connection failed: ${err.message}`);
    }
  };

  const testSTKPushEndpoint = async () => {
    try {
      console.log('Testing STK Push endpoint...');
      setLoading(true);
      
      const testPayload = {
        phoneNumber: MPESA_CONFIG.TEST_PHONE,
        amount: 1,
        reference: `TEST_${userRole || 'CUSTOMER'}_${Date.now()}`,
        description: `Test ${userRole === 'merchant' ? 'Merchant' : 'Customer'} STK Push from Frontend`,
        merchantDetails: {
          name: 'Test Merchant'
        }
      };
      
      let result;
      if (userRole === 'merchant' && token) {
        // Test merchant endpoint
        result = await triggerMerchantPayment(testPayload);
      } else {
        // Test customer endpoint - FIXED: Add required qrData
        const customerTestPayload = {
          ...testPayload,
          qrData: {
            merchantId: `test-${Date.now()}`,
            businessName: 'Test Merchant',
            businessShortCode: MPESA_CONFIG.SANDBOX_SHORTCODE
          }
        };
        result = await triggerCustomerPayment(customerTestPayload);
      }
      
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-white hover:bg-blue-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-semibold">QR Scanner</h1>
          </div>
          <QrCode className="w-6 h-6" />
        </div>
      </div>

      <div className="container mx-auto p-4 space-y-4">
        {/* Scanner Mode */}
        {isScanning ? (
          <Card>
            <CardHeader>
              <CardTitle>Scan QR Code</CardTitle>
              <CardDescription>
                Point your camera at a QR code to scan payment details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QRScannerCamera
                onSuccess={handleQRScanSuccess}
                onError={handleQRScanError}
              />
              <Button 
                variant="outline" 
                onClick={() => setIsScanning(false)}
                className="w-full mt-4"
              >
                Stop Scanning
              </Button>
            </CardContent>
          </Card>
        ) : !manualEntry ? (
          /* Main Scanner Interface */
          <>
            {/* QR Code Display */}
            {qrData && qrData.isValid ? (
              <Card className="border-green-500 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-green-800">QR Code Detected</CardTitle>
                  <CardDescription className="text-green-600">
                    Payment details extracted from QR code
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{merchantName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <span>{phoneNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span className="text-xl font-bold">KSH {amount}</span>
                    </div>
                  </div>
                  <Button 
                    onClick={handleQRPayment} 
                    className="w-full" 
                    variant="success"
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : `Pay KSH ${amount}`}
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {/* Manual Entry Option */}
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setManualEntry(true)}
                className="w-full"
                disabled={loading}
              >
                Enter Payment Details Manually
              </Button>
            </div>
          </>
        ) : (
          /* Manual Entry Form */
          <Card>
            <CardHeader>
              <CardTitle>Manual Payment</CardTitle>
              <CardDescription>
                {userRole === 'customer' 
                  ? 'Enter merchant details and amount to pay' 
                  : 'Enter payment details for testing'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant Name (Optional)</Label>
                <Input
                  id="merchant"
                  placeholder="Store name"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  {userRole === 'customer' ? 'Your Phone Number' : 'Customer Phone Number'}
                </Label>
                <Input
                  id="phone"
                  placeholder="254XXXXXXXXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (KSH)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setManualEntry(false)}
                  className="flex-1"
                  disabled={loading}
                >
                  Back to Scanner
                </Button>
                <Button 
                  onClick={handleManualPayment}
                  disabled={!phoneNumber || !amount || loading}
                  className="flex-1"
                  variant="success"
                >
                  {loading ? 'Processing...' : (userRole === 'customer' ? 'Pay Now' : 'Test Payment')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scan Options */}
        {!isScanning && !manualEntry && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={handleScanQR} 
              className="flex items-center gap-2"
              disabled={loading}
            >
              <Camera className="w-4 h-4" />
              Scan QR Code
            </Button>
            <Button 
              variant="outline" 
              onClick={handleTestQR}
              disabled={loading}
            >
              Test with Sample QR
            </Button>
          </div>
        )}
        {/* Error Display */}
        {error && (
          <Card className="border-red-500 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QRScanner;