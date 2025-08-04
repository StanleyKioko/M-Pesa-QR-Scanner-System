import { useState } from "react";
import Button from "./ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/Card";
import Input from "./ui/Input";
import Label from "./ui/Label";
import { Camera, QrCode, ArrowLeft, Phone, DollarSign, User } from "lucide-react";
import QRScannerCamera from './QRScannerCamera';
import { parseQRCode, generateSampleQRData, validatePhoneNumber, validateAmount } from '../utility/qrParser';
import { API_BASE_URL, STATUS, MPESA_CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../utility/constants';
import { paymentService } from '../utility/apiService';
import axios from 'axios';

const QRScanner = ({ onBack, onPaymentInitiated, token }) => {
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

  const handleManualPayment = async () => {
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

      // For customer mode without authentication, just proceed to confirmation
      if (!token) {
        onPaymentInitiated(paymentData);
        return;
      }

      // For authenticated users, process the payment through backend
      const response = await paymentService.triggerSTKPush({
        phoneNumber: phoneNumber.trim(),
        amount: parseFloat(amount),
        reference: `QR_${Date.now()}`,
        description: merchantName || 'QR Payment'
      });

      if (response.status === 'success') {
        paymentData.transactionId = response.transactionId;
        paymentData.transactionRef = response.transactionRef;
        paymentData.checkoutRequestID = response.data?.CheckoutRequestID;
        paymentData.customerMessage = response.data?.CustomerMessage;
        paymentData.status = STATUS.PENDING;
        
        console.log('Payment initiated successfully:', paymentData);
        onPaymentInitiated(paymentData);
      } else {
        setError(`Payment failed: ${response.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(`Payment failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQRPayment = async () => {
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

      // For customer mode without authentication
      if (!token) {
        onPaymentInitiated(paymentData);
        return;
      }

      // For authenticated users, process through backend
      const response = await paymentService.triggerSTKPush({
        phoneNumber: phoneNumber.trim(),
        amount: parseFloat(amount),
        reference: qrData.reference || `QR_${Date.now()}`,
        description: qrData.description || merchantName || 'QR Payment'
      });

      if (response.status === 'success') {
        paymentData.transactionId = response.transactionId;
        paymentData.transactionRef = response.transactionRef;
        paymentData.checkoutRequestID = response.data?.CheckoutRequestID;
        paymentData.customerMessage = response.data?.CustomerMessage;
        paymentData.status = STATUS.PENDING;
        
        console.log('QR Payment initiated successfully:', paymentData);
        onPaymentInitiated(paymentData);
      } else {
        setError(`Payment failed: ${response.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('QR Payment error:', err);
      setError(`Payment failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-white hover:bg-blue-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold">QR Scanner</h1>
            <p className="text-sm text-blue-100">Scan to pay instantly</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {!manualEntry ? (
          <>
            {/* QR Scanner Section */}
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  {!isScanning ? (
                    <div className="mx-auto w-64 h-64 rounded-lg border-2 border-dashed border-blue-300 flex items-center justify-center bg-blue-50">
                      <div className="text-center">
                        <Camera className="w-16 h-16 text-blue-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Position QR code here</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto w-64 h-64 rounded-lg overflow-hidden">
                      <QRScannerCamera 
                        onScanSuccess={handleQRScanSuccess}
                        onScanError={handleQRScanError}
                      />
                    </div>
                  )}

                  {!isScanning && (
                    <div className="space-y-2">
                      <Button 
                        onClick={handleScanQR} 
                        className="w-full"
                        variant="success"
                      >
                        Start QR Scan
                      </Button>
                      <Button 
                        onClick={handleTestQR} 
                        variant="outline"
                        className="w-full"
                      >
                        Test QR Code
                      </Button>
                    </div>
                  )}

                  {isScanning && (
                    <Button 
                      onClick={() => setIsScanning(false)} 
                      variant="destructive"
                      className="w-full"
                    >
                      Stop Scanning
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Scanned QR Result */}
            {merchantName && !isScanning && (
              <Card className="border-green-500">
                <CardHeader>
                  <CardTitle className="text-green-600 flex items-center gap-2">
                    <QrCode className="w-5 h-5" />
                    QR Code Detected
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
            )}

            {/* Manual Entry Option */}
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setManualEntry(true)}
                className="w-full"
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
                Enter merchant details and amount
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="254XXXXXXXXX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
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
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setManualEntry(false)}
                  className="flex-1"
                >
                  Back to Scanner
                </Button>
                <Button 
                  onClick={handleManualPayment}
                  disabled={!phoneNumber || !amount || loading}
                  className="flex-1"
                  variant="success"
                >
                  {loading ? 'Processing...' : 'Pay Now'}
                </Button>
              </div>
            </CardContent>
          </Card>
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