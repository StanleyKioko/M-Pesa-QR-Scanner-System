import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button'; // Changed to default import
import Input from './ui/Input';   // Changed to default import
import { Label } from './ui/Label'; // Keep named import (it has both)
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
  ArrowLeft
} from 'lucide-react';

const MerchantQRGenerator = ({ user, onBack }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Payment');
  const [reference, setReference] = useState('');
  const [qrData, setQrData] = useState(null);
  const [showQRDetails, setShowQRDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  // Generate QR Code Data
  const generateQRData = () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const qrPayload = {
      merchantId: user.uid,
      businessName: user.name || 'Merchant Store',
      businessShortCode: user.shortcode || process.env.REACT_APP_MPESA_SHORTCODE,
      phone: user.phone,
      amount: parseFloat(amount),
      description: description || 'Payment',
      reference: reference || `QR_${Date.now()}`,
      timestamp: new Date().toISOString(),
      version: '1.0',
      type: 'merchant_payment'
    };

    const qrString = JSON.stringify(qrPayload);
    
    setQrData({
      payload: qrPayload,
      qrString: qrString,
      displayData: `${user.name || 'Merchant'} - KSH ${amount}`,
      shareableLink: `${window.location.origin}/pay?data=${encodeURIComponent(qrString)}`
    });
  };

  // Generate QR Code using external library or service
  const generateQRCodeImage = async (data) => {
    try {
      // Using qr-server.com API for QR generation (free service)
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;
      return qrImageUrl;
    } catch (error) {
      console.error('QR generation error:', error);
      return null;
    }
  };

  // Copy QR data to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy');
    });
  };

  // Download QR Code
  const downloadQRCode = async () => {
    if (!qrData) return;
    
    setLoading(true);
    try {
      const qrImageUrl = await generateQRCodeImage(qrData.qrString);
      if (qrImageUrl) {
        const link = document.createElement('a');
        link.href = qrImageUrl;
        link.download = `merchant-qr-${reference || Date.now()}.png`;
        link.click();
      }
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Share QR Code
  const shareQRCode = async () => {
    if (!qrData) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payment to ${user.name}`,
          text: `Scan this QR code to pay KSH ${amount} to ${user.name}`,
          url: qrData.shareableLink
        });
      } catch (error) {
        console.log('Share failed:', error);
        copyToClipboard(qrData.shareableLink);
      }
    } else {
      copyToClipboard(qrData.shareableLink);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QR Code Generator</h1>
            <p className="text-gray-600">Generate payment QR codes for customers</p>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Merchant Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Merchant Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="flex items-center gap-2">
                <span className="font-medium">ID:</span>
                <span className="font-mono text-xs">{user.uid?.substring(0, 8)}...</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Generator Form */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Payment QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (KSH) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10"
                    step="0.01"
                    min="1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Payment for goods/services"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reference">Reference (Optional)</Label>
                <Input
                  id="reference"
                  placeholder="INV001, Order#123, etc."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>

            <Button 
              onClick={generateQRData} 
              className="w-full"
              disabled={!amount || parseFloat(amount) <= 0}
            >
              <QrCode className="w-4 h-4 mr-2" />
              Generate QR Code
            </Button>
          </CardContent>
        </Card>

        {/* Generated QR Code Display */}
        {qrData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Your Payment QR Code</span>
                <div className="flex items-center gap-2">
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
              <div className="text-center space-y-4">
                {/* QR Code Image */}
                <div className="flex justify-center">
                  <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData.qrString)}`}
                      alt="Payment QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                </div>

                {/* Payment Details */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">Payment Details</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span className="font-semibold">KSH {qrData.payload.amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Description:</span>
                      <span>{qrData.payload.description}</span>
                    </div>
                    {qrData.payload.reference && (
                      <div className="flex justify-between">
                        <span>Reference:</span>
                        <span className="font-mono text-xs">{qrData.payload.reference}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Merchant:</span>
                      <span>{qrData.payload.businessName}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    onClick={downloadQRCode}
                    disabled={loading}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {loading ? 'Downloading...' : 'Download'}
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
                    onClick={() => copyToClipboard(qrData.qrString)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Data
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
                          {JSON.stringify(qrData.payload, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="font-medium">Shareable Link:</span>
                        <div className="bg-white p-2 rounded mt-1 break-all">
                          {qrData.shareableLink}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="bg-green-50 p-4 rounded-lg text-left">
                  <h4 className="font-semibold text-green-900 mb-2">How to Use</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>1. Show this QR code to your customer</li>
                    <li>2. Customer scans with the QR Scanner app</li>
                    <li>3. Customer enters their phone number and confirms payment</li>
                    <li>4. M-Pesa STK push will be sent to customer's phone</li>
                    <li>5. Transaction will appear in your dashboard</li>
                  </ul>
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