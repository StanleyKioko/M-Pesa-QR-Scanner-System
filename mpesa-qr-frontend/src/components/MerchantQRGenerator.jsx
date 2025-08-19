import React, { useState, useEffect, useRef } from 'react';
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
  Check,
  AlertCircle,
  Loader2,
  Settings,
  Save,
  Trash2
} from 'lucide-react';

const MerchantQRGenerator = ({ user, onBack, authToken }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Payment');
  const [reference, setReference] = useState('');
  const [includeAmount, setIncludeAmount] = useState(true);
  const [qrData, setQrData] = useState(null);
  const [showQRDetails, setShowQRDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedQRs, setSavedQRs] = useState([]);
  const qrImageRef = useRef(null);

  // API Base URL
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

  // Load saved QR codes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`saved_qrs_${user.uid}`);
    if (saved) {
      try {
        setSavedQRs(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading saved QRs:', e);
      }
    }
  }, [user.uid]);

  // Save QR to localStorage
  const saveQRCode = () => {
    if (!qrData) return;
    
    const qrToSave = {
      id: `qr_${Date.now()}`,
      ...qrData,
      savedAt: new Date().toISOString(),
      name: `${description} - KSH ${amount || 'Variable'}`
    };
    
    const updated = [qrToSave, ...savedQRs.slice(0, 9)]; // Keep max 10 saved QRs
    setSavedQRs(updated);
    localStorage.setItem(`saved_qrs_${user.uid}`, JSON.stringify(updated));
    setSuccess('QR code saved successfully!');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Load saved QR code
  const loadSavedQR = (savedQR) => {
    setAmount(savedQR.data.qrCode.payload.amount || '');
    setDescription(savedQR.data.qrCode.payload.description || '');
    setReference(savedQR.data.qrCode.payload.reference || '');
    setQrData(savedQR);
    setError('');
  };

  // Delete saved QR code
  const deleteSavedQR = (qrId) => {
    const updated = savedQRs.filter(qr => qr.id !== qrId);
    setSavedQRs(updated);
    localStorage.setItem(`saved_qrs_${user.uid}`, JSON.stringify(updated));
  };

  // Generate QR Code via API
  const generateQRCode = async () => {
    if (includeAmount && (!amount || parseFloat(amount) <= 0)) {
      setError('Please enter a valid amount');
      return;
    }

    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('🔗 Generating QR code via API...');
      
      const response = await fetch(`${API_BASE_URL}/daraja/generate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          amount: includeAmount ? parseFloat(amount) : null,
          description: description.trim(),
          reference: reference.trim() || undefined,
          includeAmount: includeAmount
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate QR code');
      }

      console.log('✅ QR code generated successfully:', result);
      setQrData(result);
      setSuccess('QR code generated successfully!');
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      console.error('💥 QR generation error:', err);
      setError(err.message || 'Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  // Generate QR Code locally (fallback)
  const generateQRCodeLocal = () => {
    if (includeAmount && (!amount || parseFloat(amount) <= 0)) {
      setError('Please enter a valid amount');
      return;
    }

    const qrPayload = {
      version: '1.0',
      type: 'merchant_payment',
      merchantId: user.uid,
      businessName: user.name || 'M-Pesa Merchant',
      businessShortCode: user.shortcode || '174379',
      phone: user.phone || '',
      amount: includeAmount ? parseFloat(amount) : null,
      description: description || 'Payment',
      reference: reference || `QR_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    const qrString = JSON.stringify(qrPayload);
    
    const localQRData = {
      success: true,
      data: {
        qrCode: {
          payload: qrPayload,
          qrString: qrString,
          reference: qrPayload.reference
        },
        merchant: {
          name: user.name,
          phone: user.phone,
          shortcode: user.shortcode
        },
        sharing: {
          shareableLink: `${window.location.origin}/pay?data=${encodeURIComponent(qrString)}`,
          displayText: qrPayload.amount 
            ? `Pay KSH ${qrPayload.amount} to ${user.name}` 
            : `Payment to ${user.name}`,
          qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`
        }
      }
    };

    setQrData(localQRData);
    setError('');
    setSuccess('QR code generated locally!');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Copy to clipboard
  const copyToClipboard = async (text, type = 'text') => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess(`${type} copied to clipboard!`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
      setTimeout(() => setError(''), 2000);
    }
  };

  // Download QR Code
  const downloadQRCode = async () => {
    if (!qrData?.data?.sharing?.qrImageUrl) return;
    
    setLoading(true);
    try {
      const response = await fetch(qrData.data.sharing.qrImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `merchant-qr-${qrData.data.qrCode.reference}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setSuccess('QR code downloaded successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download QR code');
      setTimeout(() => setError(''), 2000);
    } finally {
      setLoading(false);
    }
  };

  // Share QR Code
  const shareQRCode = async () => {
    if (!qrData?.data?.sharing) return;

    const shareData = {
      title: `Payment to ${user.name}`,
      text: qrData.data.sharing.displayText,
      url: qrData.data.sharing.shareableLink
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error.name !== 'AbortError') {
          copyToClipboard(qrData.data.sharing.shareableLink, 'Link');
        }
      }
    } else {
      copyToClipboard(qrData.data.sharing.shareableLink, 'Link');
    }
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">QR Code Generator</h1>
            <p className="text-gray-600">Generate payment QR codes for your customers</p>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-green-800">{success}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Forms */}
          <div className="space-y-6">
            {/* Merchant Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Merchant Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Business:</span>
                    <span>{user.name || 'Not Set'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{user.phone || 'Not Set'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Shortcode:</span>
                    <span className="font-mono">{user.shortcode || 'Default'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* QR Generator Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  QR Code Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Include Amount Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="includeAmount">Fixed Amount QR</Label>
                  <input
                    type="checkbox"
                    id="includeAmount"
                    checked={includeAmount}
                    onChange={(e) => setIncludeAmount(e.target.checked)}
                    className="rounded"
                  />
                </div>

                {/* Amount Field */}
                {includeAmount && (
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (KSH) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="amount"
                        type="number"
                        placeholder="100.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="pl-10"
                        step="0.01"
                        min="1"
                      />
                    </div>
                  </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Input
                    id="description"
                    placeholder="Payment for goods/services"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {/* Reference */}
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference (Optional)</Label>
                  <Input
                    id="reference"
                    placeholder="INV001, Order#123, etc."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                  <Button 
                    onClick={generateQRCode} 
                    disabled={loading || (!includeAmount ? false : (!amount || parseFloat(amount) <= 0))}
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <QrCode className="w-4 h-4 mr-2" />
                    )}
                    Generate QR Code
                  </Button>

                  <Button 
                    variant="outline"
                    onClick={clearForm}
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </div>

                {/* Fallback Button */}
                <Button 
                  variant="outline"
                  onClick={generateQRCodeLocal} 
                  disabled={loading || (!includeAmount ? false : (!amount || parseFloat(amount) <= 0))}
                  className="w-full text-sm"
                >
                  Generate Offline
                </Button>
              </CardContent>
            </Card>

            {/* Saved QR Codes */}
            {savedQRs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Saved QR Codes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {savedQRs.map((savedQR) => (
                      <div key={savedQR.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="text-sm font-medium">{savedQR.name}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(savedQR.savedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadSavedQR(savedQR)}
                          >
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteSavedQR(savedQR.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - QR Display */}
          <div className="space-y-6">
            {/* Generated QR Code Display */}
            {qrData?.success && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Payment QR Code</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowQRDetails(!showQRDetails)}
                      >
                        {showQRDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={saveQRCode}
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-4">
                    {/* QR Code Image */}
                    <div className="flex justify-center">
                      <div className="p-4 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
                        <img
                          ref={qrImageRef}
                          src={qrData.data.sharing.qrImageUrl}
                          alt="Payment QR Code"
                          className="w-64 h-64"
                        />
                      </div>
                    </div>

                    {/* Payment Details */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-2">Payment Details</h3>
                      <div className="space-y-1 text-sm">
                        {qrData.data.qrCode.payload.amount && (
                          <div className="flex justify-between">
                            <span>Amount:</span>
                            <span className="font-semibold">KSH {qrData.data.qrCode.payload.amount}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Description:</span>
                          <span>{qrData.data.qrCode.payload.description}</span>
                        </div>
                        {qrData.data.qrCode.payload.reference && (
                          <div className="flex justify-between">
                            <span>Reference:</span>
                            <span className="font-mono text-xs">{qrData.data.qrCode.payload.reference}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Merchant:</span>
                          <span>{qrData.data.qrCode.payload.businessName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Button
                        variant="outline"
                        onClick={downloadQRCode}
                        disabled={loading}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>

                      <Button
                        variant="outline"
                        onClick={shareQRCode}
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(qrData.data.qrCode.qrString, 'QR Data')}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                    </div>

                    {/* Technical Details (collapsed by default) */}
                    {showQRDetails && (
                      <div className="bg-gray-50 p-4 rounded-lg text-left">
                        <h4 className="font-semibold mb-2">Technical Details</h4>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="font-medium">QR Data:</span>
                            <pre className="bg-white p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(qrData.data.qrCode.payload, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <span className="font-medium">Shareable Link:</span>
                            <div className="bg-white p-2 rounded mt-1 break-all">
                              {qrData.data.sharing.shareableLink}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Instructions */}
                    <div className="bg-green-50 p-4 rounded-lg text-left">
                      <h4 className="font-semibold text-green-900 mb-2">How Customers Use This QR</h4>
                      <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside">
                        <li>Customer scans this QR code with their phone camera or QR app</li>
                        <li>They'll be directed to the payment page</li>
                        <li>Customer enters their M-Pesa phone number</li>
                        <li>{qrData.data.qrCode.payload.amount ? 'Amount is pre-filled' : 'Customer enters payment amount'}</li>
                        <li>M-Pesa STK push is sent to customer's phone</li>
                        <li>Customer completes payment on their phone</li>
                        <li>You receive notification and payment reflects in your account</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instructions when no QR generated */}
            {!qrData && (
              <Card>
                <CardHeader>
                  <CardTitle>How to Generate QR Codes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-medium mb-2">Fixed Amount QR:</h4>
                      <p className="text-gray-600">
                        Enable "Fixed Amount QR" and set the amount. Best for specific products or services with set prices.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Variable Amount QR:</h4>
                      <p className="text-gray-600">
                        Disable "Fixed Amount QR" to let customers enter any amount. Good for donations or flexible payments.
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-blue-800 text-xs">
                        💡 <strong>Tip:</strong> Save frequently used QR codes for quick access later.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchantQRGenerator;