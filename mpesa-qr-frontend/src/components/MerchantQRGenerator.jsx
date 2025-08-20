import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import { Label } from './ui/Label';
import { 
  QrCode, 
  Download, 
  Copy,
  RefreshCw,
  DollarSign,
  User,
  Phone,
  Share2,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Server,
  Wifi,
  WifiOff,
  Settings
} from 'lucide-react';
import { API_BASE_URL, MPESA_CONFIG } from '../utility/constants';

const MerchantQRGenerator = ({ user, onBack, token }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Payment');
  const [reference, setReference] = useState('');
  const [qrData, setQrData] = useState(null);
  const [showQRDetails, setShowQRDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [backendStatus, setBackendStatus] = useState('unknown'); // 'connected', 'disconnected', 'unknown'

  // Check backend connection on component mount
  useEffect(() => {
    checkBackendConnection();
  }, []);

  // Check backend connectivity
  const checkBackendConnection = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      setBackendStatus('connected');
      console.log('✅ Backend connection verified:', response.data);
    } catch (error) {
      setBackendStatus('disconnected');
      console.error('❌ Backend connection failed:', error.message);
    }
  };

  // Validate form inputs
  const validateInputs = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount greater than 0');
      return false;
    }
    
    if (parseFloat(amount) > 70000) {
      setError('Amount cannot exceed KSH 70,000 (M-Pesa limit)');
      return false;
    }

    if (!user?.uid) {
      setError('Merchant information is missing. Please log in again.');
      return false;
    }

    return true;
  };

  // Generate QR Code Data with backend integration
  const generateQRData = async () => {
    setError('');
    setSuccess('');

    if (!validateInputs()) {
      return;
    }

    setLoading(true);

    try {
      // Check backend connection first
      if (backendStatus === 'disconnected') {
        await checkBackendConnection();
      }

      // Prepare QR payload
      const qrPayload = {
        merchantId: user.uid,
        businessName: user.name || user.email?.split('@')[0] || 'Merchant Store',
        businessShortCode: user.shortcode || MPESA_CONFIG.SANDBOX_SHORTCODE,
        phone: user.phone || 'Not Set',
        amount: parseFloat(amount),
        description: description.trim() || 'Payment',
        reference: reference.trim() || `QR_${Date.now()}`,
        timestamp: new Date().toISOString(),
        version: '1.0',
        type: 'merchant_payment',
        // Additional metadata for enhanced functionality
        currency: 'KSH',
        country: 'KE',
        merchantType: 'registered',
        isValid: true
      };

      // Generate QR code via backend API
      let backendQRData = null;
      try {
        if (backendStatus === 'connected' && token) {
          const response = await axios.post(
            `${API_BASE_URL}/daraja/generate-qr`,
            {
              amount: parseFloat(amount),
              description: description.trim() || 'Payment',
              reference: reference.trim() || `QR_${Date.now()}`,
              businessName: qrPayload.businessName
            },
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            }
          );

          if (response.data.success) {
            backendQRData = response.data.data;
            console.log('✅ Backend QR generation successful:', backendQRData);
          }
        }
      } catch (backendError) {
        console.warn('⚠️ Backend QR generation failed, using frontend fallback:', backendError.message);
        // Continue with frontend generation
      }

      const qrString = JSON.stringify(qrPayload);
      
      // Create comprehensive QR data object
      const generatedQRData = {
        payload: qrPayload,
        qrString: qrString,
        displayData: `${qrPayload.businessName} - KSH ${amount}`,
        shareableLink: `${window.location.origin}/pay?data=${encodeURIComponent(qrString)}`,
        backendData: backendQRData,
        generatedAt: new Date().toISOString(),
        generatedBy: 'frontend',
        isBackendGenerated: !!backendQRData,
        qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`,
        downloadUrl: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&download=1&data=${encodeURIComponent(qrString)}`
      };

      setQrData(generatedQRData);
      setSuccess(`✅ QR Code generated successfully! ${backendQRData ? '(Backend verified)' : '(Frontend generated)'}`);
      console.log('🎯 QR Code generated:', generatedQRData);

    } catch (error) {
      console.error('💥 QR generation error:', error);
      setError(`Failed to generate QR code: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced QR Code image generation with error handling
  const generateQRCodeImage = async (data, size = '300x300') => {
    try {
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(data)}&ecc=M`;
      
      // Test if the URL is accessible
      const testResponse = await fetch(qrImageUrl, { method: 'HEAD' });
      if (testResponse.ok) {
        return qrImageUrl;
      } else {
        throw new Error('QR service unavailable');
      }
    } catch (error) {
      console.error('QR image generation error:', error);
      // Fallback to a different service or return a placeholder
      return `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="#f0f0f0"/><text x="150" y="150" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">QR Code</text></svg>')}`;
    }
  };

  // Copy to clipboard with feedback
  const copyToClipboard = async (text, type = 'text') => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`✅ ${type} copied to clipboard!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Copy failed:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setSuccess(`✅ ${type} copied to clipboard!`);
        setTimeout(() => setSuccess(''), 3000);
      } catch (fallbackError) {
        setError('Failed to copy to clipboard');
      }
      document.body.removeChild(textArea);
    }
  };

  // Enhanced download functionality
  const downloadQRCode = async () => {
    if (!qrData) return;
    
    setLoading(true);
    try {
      const qrImageUrl = await generateQRCodeImage(qrData.qrString, '400x400');
      
      // Create download link
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `merchant-qr-${qrData.payload.reference || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);
      setSuccess('✅ QR Code downloaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download QR code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced share functionality
  const shareQRCode = async () => {
    if (!qrData) return;

    const shareData = {
      title: `Payment to ${qrData.payload.businessName}`,
      text: `Scan this QR code to pay KSH ${qrData.payload.amount} to ${qrData.payload.businessName}`,
      url: qrData.shareableLink
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setSuccess('✅ QR Code shared successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.log('Share failed:', error);
          copyToClipboard(qrData.shareableLink, 'Payment link');
        }
      }
    } else {
      // Fallback: copy link to clipboard
      copyToClipboard(qrData.shareableLink, 'Payment link');
    }
  };

  // Generate new reference
  const generateNewReference = () => {
    const newRef = `QR_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setReference(newRef);
  };

  // Clear form
  const clearForm = () => {
    setAmount('');
    setDescription('Payment');
    setReference('');
    setQrData(null);
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">QR Code Generator</h1>
            <p className="text-gray-600">Generate secure payment QR codes for customers</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Backend Status Indicator */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              backendStatus === 'connected' 
                ? 'bg-green-100 text-green-800' 
                : backendStatus === 'disconnected'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {backendStatus === 'connected' ? (
                <>
                  <Wifi className="w-4 h-4" />
                  Connected
                </>
              ) : backendStatus === 'disconnected' ? (
                <>
                  <WifiOff className="w-4 h-4" />
                  Offline
                </>
              ) : (
                <>
                  <Server className="w-4 h-4" />
                  Checking...
                </>
              )}
            </div>
            
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <span>{success}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Merchant Info Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="w-6 h-6 text-blue-600" />
              Merchant Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Business Name:</span>
                  <span className="text-gray-900">{user.name || user.email?.split('@')[0] || 'Not Set'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-600" />
                  <span className="text-gray-900">{user.phone || 'Not Set'}</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Shortcode:</span>
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{user.shortcode || MPESA_CONFIG.SANDBOX_SHORTCODE}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Merchant ID:</span>
                  <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{user.uid?.substring(0, 12)}...</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Generator Form */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Generate Payment QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (KSH) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10 text-lg"
                    step="0.01"
                    min="1"
                    max="70000"
                  />
                </div>
                <p className="text-xs text-gray-500">Maximum: KSH 70,000</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Payment for goods/services"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-gray-500">{description.length}/100 characters</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reference">Reference (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="reference"
                    placeholder="INV001, Order#123, etc."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    maxLength={50}
                  />
                  <Button
                    variant="outline"
                    onClick={generateNewReference}
                    type="button"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Auto-generated if not provided</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={generateQRData} 
                className="flex-1"
                disabled={!amount || parseFloat(amount) <= 0 || loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Generate QR Code
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={clearForm}
                disabled={loading}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generated QR Code Display */}
        {qrData && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-xl">
                <span>Your Payment QR Code</span>
                <div className="flex items-center gap-2">
                  {qrData.isBackendGenerated && (
                    <div className="flex items-center gap-1 text-green-600 text-sm">
                      <Server className="w-4 h-4" />
                      Backend Verified
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQRDetails(!showQRDetails)}
                  >
                    {showQRDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {showQRDetails ? 'Hide' : 'Show'} Details
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-6">
                {/* QR Code Image */}
                <div className="flex justify-center">
                  <div className="p-6 bg-white border-2 border-gray-200 rounded-xl shadow-md">
                    <img
                      src={qrData.qrImageUrl}
                      alt="Payment QR Code"
                      className="w-64 h-64"
                      onError={(e) => {
                        e.target.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#f0f0f0"/><text x="128" y="128" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">QR Code</text></svg>')}`;
                      }}
                    />
                  </div>
                </div>

                {/* Payment Details */}
                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-xl">
                  <h3 className="font-bold text-blue-900 mb-4 text-lg">Payment Details</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Amount:</span>
                      <span className="font-bold text-green-600 text-xl">KSH {qrData.payload.amount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Description:</span>
                      <span>{qrData.payload.description}</span>
                    </div>
                    {qrData.payload.reference && (
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Reference:</span>
                        <span className="font-mono text-sm bg-white px-2 py-1 rounded">{qrData.payload.reference}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Merchant:</span>
                      <span className="font-semibold">{qrData.payload.businessName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Generated:</span>
                      <span className="text-sm">{new Date(qrData.generatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Button
                    variant="outline"
                    onClick={downloadQRCode}
                    disabled={loading}
                    className="h-12"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {loading ? 'Downloading...' : 'Download'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={shareQRCode}
                    className="h-12"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(qrData.qrString, 'QR Data')}
                    className="h-12"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Data
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(qrData.shareableLink, 'Payment Link')}
                    className="h-12"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                </div>

                {/* Technical Details (collapsed by default) */}
                {showQRDetails && (
                  <div className="bg-gray-50 p-6 rounded-xl text-left">
                    <h4 className="font-bold mb-4 text-gray-800">Technical Details</h4>
                    <div className="space-y-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-700">QR Data Structure:</span>
                        <pre className="bg-white p-4 rounded-lg mt-2 overflow-x-auto text-xs border">
                          {JSON.stringify(qrData.payload, null, 2)}
                        </pre>
                      </div>
                      
                      <div>
                        <span className="font-semibold text-gray-700">Shareable Payment Link:</span>
                        <div className="bg-white p-4 rounded-lg mt-2 break-all text-xs border">
                          {qrData.shareableLink}
                        </div>
                      </div>

                      {qrData.backendData && (
                        <div>
                          <span className="font-semibold text-gray-700">Backend Verification:</span>
                          <pre className="bg-white p-4 rounded-lg mt-2 overflow-x-auto text-xs border">
                            {JSON.stringify(qrData.backendData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl text-left">
                  <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    How to Use This QR Code
                  </h4>
                  <ul className="text-sm text-green-800 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">1.</span>
                      <span>Display this QR code to your customer (on screen or printed)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">2.</span>
                      <span>Customer opens the QR Scanner app on their phone</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">3.</span>
                      <span>Customer scans the QR code and confirms payment details</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">4.</span>
                      <span>Customer enters their M-Pesa phone number</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">5.</span>
                      <span>M-Pesa STK push is sent to customer's phone</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-green-600">6.</span>
                      <span>Transaction appears in your merchant dashboard automatically</span>
                    </li>
                  </ul>
                  
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> For testing, use phone number 254708374149 in sandbox mode.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MerchantQRGenerator;