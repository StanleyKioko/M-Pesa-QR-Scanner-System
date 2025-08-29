import React, { useState, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Download, 
  Share2, 
  AlertCircle, 
  CheckCircle,
  QrCode
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button'; // Default export
import Input from './ui/Input';   // Default export
import { Label } from './ui/Label';
import { Badge } from './ui/Badge';
import { useAuth } from '../hooks/useAuth';

const MerchantQRGenerator = () => {
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [qrData, setQrData] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const qrRef = useRef(null);
  const { user } = useAuth();

  // Generate QR data using backend
  const generateQRData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/daraja/generate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dynamicAmount: true,
          description: description || 'Payment',
          reference: reference || undefined,
          businessName: businessName || undefined
        })
      });

      // Log the raw response for debugging
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        console.error('Failed to parse backend response as JSON:', text);
        setError('Invalid response from server. Please contact support.');
        setLoading(false);
        return;
      }
      console.log('Backend response:', result);

      if (response.ok && result.success) {
        setQrData(result.data);

        // Use qrUrl from backend as the QR code value
        if (
          !result.data ||
          !result.data.qrUrl ||
          typeof result.data.qrUrl !== 'string' ||
          result.data.qrUrl.trim() === ''
        ) {
          console.error('Invalid qrUrl received from backend:', result.data);
          setError('QR code data is missing or invalid from server.');
          setLoading(false);
          return;
        }

        try {
          const qrImageUrl = await generateQRCodeImage(result.data.qrUrl, '400x400');
          setQrCodeUrl(qrImageUrl);
        } catch (imgErr) {
          console.error('Error generating QR code image:', imgErr, 'qrUrl:', result.data.qrUrl);
          setError('QR code generated but failed to render image. (Invalid QR data)');
          return;
        }
        setSuccess('Dynamic M-Pesa QR Code generated successfully! Customers will be prompted to enter the amount.');
      } else {
        // Show backend error if available
        setError(result.message || result.error || 'Failed to generate QR code');
      }
    } catch (err) {
      console.error('QR Generation Error:', err);
      setError('Failed to generate QR code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate QR code image from data
  const generateQRCodeImage = async (data, size = '300x300') => {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        width: parseInt(size.split('x')[0]),
        height: parseInt(size.split('x')[1]),
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Error generating QR code image:', error);
      throw error;
    }
  };

  // Generate unique reference
  const generateReference = () => {
    const timestamp = Date.now().toString().slice(-6);
    setReference(`REF${timestamp}`);
  };

  // Clear form
  const clearForm = () => {
    setDescription('');
    setReference('');
    setBusinessName('');
    setQrData(null);
    setQrCodeUrl('');
    setError('');
    setSuccess('');
  };

  // Download QR code
  const downloadQRCode = async () => {
    if (!qrData || !qrCodeUrl) {
      setError('Generate a QR code first');
      return;
    }

    try {
      // Use qrUrl for download as well
      const qrImageUrl = await generateQRCodeImage(qrData.qrUrl, '400x400');
      
      const link = document.createElement('a');
      link.href = qrImageUrl;
      link.download = `mpesa-qr-dynamic-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('QR code downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download QR code');
    }
  };

  // Share QR code
  const shareQRCode = async () => {
    if (!qrData || !qrCodeUrl) {
      setError('Generate a QR code first');
      return;
    }

    try {
      if (navigator.share) {
        // Convert data URL to blob for sharing
        const response = await fetch(qrCodeUrl);
        const blob = await response.blob();
        const file = new File([blob], `mpesa-qr-dynamic.png`, { type: 'image/png' });

        await navigator.share({
          title: `M-Pesa Payment QR - Dynamic Amount`,
          text: `Pay to ${qrData.businessName} by scanning this M-Pesa QR code and entering your amount`,
          files: [file]
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`Pay to ${qrData.businessName} - M-Pesa QR Code Generated`);
        setSuccess('Payment details copied to clipboard!');
      }
    } catch (error) {
      console.error('Share error:', error);
      setError('Failed to share QR code');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Generate Dynamic M-Pesa QR Code
          </CardTitle>
          <p className="text-gray-600">Create QR codes that allow customers to enter their own payment amount</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                placeholder="Your Business Name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-gray-500">Displayed to customers</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Payment Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={100}
              />
              <p className="text-xs text-gray-500">What is this payment for?</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="reference"
                  placeholder="Payment Reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={20}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateReference}
                  className="flex-shrink-0"
                >
                  Generate
                </Button>
              </div>
              <p className="text-xs text-gray-500">Your internal reference ID</p>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={generateQRData}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" />
              {loading ? 'Generating...' : 'Generate QR Code'}
            </Button>
            
            <Button
              variant="outline"
              onClick={clearForm}
              disabled={loading}
              className="flex items-center gap-2"
            >
              Clear
            </Button>
          </div>

          {/* QR Code Display */}
          {qrCodeUrl && (
            <div className="mt-6 border rounded-lg p-6 bg-white">
              <div className="flex flex-col items-center space-y-4">
                <div className="bg-white p-4 rounded-lg shadow-md">
                  <img
                    src={qrCodeUrl}
                    alt="M-Pesa QR Code"
                    className="w-64 h-64 object-contain"
                    ref={qrRef}
                  />
                </div>
                
                <div className="text-center space-y-2">
                  <p className="font-bold text-lg">Dynamic Payment QR Code</p>
                  <p className="text-sm text-gray-600">
                    Business: {businessName || 'Your Business'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Description: {description || 'Payment'}
                  </p>
                  {reference && (
                    <p className="text-sm text-gray-600">
                      Reference: {reference}
                    </p>
                  )}
                  <Badge variant="outline" className="mt-2">
                    Customer will enter amount
                  </Badge>
                </div>
                
                <div className="flex gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={downloadQRCode}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={shareQRCode}
                    className="flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantQRGenerator;