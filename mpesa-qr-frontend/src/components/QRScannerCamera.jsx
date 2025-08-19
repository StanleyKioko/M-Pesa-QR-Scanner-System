import { useState, useRef, useEffect } from 'react';
import jsQR from 'jsqr';

function QRScannerCamera({ onSuccess, onError }) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [cameraPermission, setCameraPermission] = useState(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [scanAttempts, setScanAttempts] = useState(0);
  const [detectedQR, setDetectedQR] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    checkCameraSupport();
    
    return () => {
      stopCamera();
    };
  }, []);

  const checkCameraSupport = async () => {
    try {
      console.log('🔍 Checking camera support...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported by this browser');
      }

      setCameraPermission('granted');
      console.log('✅ Camera supported');
      
    } catch (err) {
      console.error('❌ Camera support check failed:', err);
      setCameraPermission('denied');
      setError('Camera not supported by this browser. Please use Chrome, Firefox, or Edge.');
    }
  };

  const startCamera = async () => {
    if (isScanning) {
      console.log('⚠️ Camera already running');
      return;
    }
    
    console.log('🚀 Starting camera...');
    
    setIsScanning(true);
    setError('');
    setScannerReady(false);
    setLastScannedCode('');
    setScanAttempts(0);
    setDetectedQR(null);
    
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Request camera access with multiple fallback options
      let stream = null;
      
      // Try different camera configurations
      const cameraConfigs = [
        { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
        { video: { facingMode: 'environment' } },
        { video: { facingMode: 'user' } },
        { video: true }
      ];

      for (const config of cameraConfigs) {
        try {
          console.log('🎥 Trying camera config:', config);
          stream = await navigator.mediaDevices.getUserMedia(config);
          console.log('✅ Camera stream obtained');
          break;
        } catch (err) {
          console.warn('⚠️ Camera config failed:', err.message);
          continue;
        }
      }

      if (!stream) {
        throw new Error('Unable to access camera with any configuration');
      }

      streamRef.current = stream;

      // Set up video element
      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element not found');
      }

      video.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          console.log('📹 Video metadata loaded');
          console.log('📐 Video dimensions:', video.videoWidth, 'x', video.videoHeight);
          resolve();
        };
        
        video.onerror = (err) => {
          console.error('❌ Video error:', err);
          reject(new Error('Video failed to load'));
        };
        
        // Timeout fallback
        setTimeout(() => {
          if (video.readyState >= 1) {
            console.log('⏰ Video ready via timeout');
            resolve();
          } else {
            reject(new Error('Video failed to load within timeout'));
          }
        }, 5000);
      });

      // Start video playback
      await video.play();
      console.log('▶️ Video playing');

      setScannerReady(true);
      
      // Start QR code scanning
      startQRScanning();
      
    } catch (err) {
      console.error('💥 Camera start failed:', err);
      
      let errorMessage = 'Failed to start camera';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and refresh the page.';
        setCameraPermission('denied');
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is being used by another application. Please close other apps using the camera.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not support the required settings. Trying with basic settings...';
        // Try again with basic settings
        setTimeout(() => {
          setError('');
          startBasicCamera();
        }, 1000);
        return;
      } else {
        errorMessage = `Camera error: ${err.message}`;
      }
      
      setError(errorMessage);
      setIsScanning(false);
      
      if (onError) {
        onError(err);
      }
    }
  };

  const startBasicCamera = async () => {
    console.log('🔄 Trying basic camera...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      
      setScannerReady(true);
      startQRScanning();
      
    } catch (err) {
      console.error('💥 Basic camera failed:', err);
      setError('Unable to access camera. Please check permissions and try again.');
      setIsScanning(false);
    }
  };

  const startQRScanning = () => {
    console.log('🔍 Starting QR scanning...');
    
    // Scan more frequently for better detection
    scanIntervalRef.current = setInterval(() => {
      scanForQRCode();
    }, 100); // Scan every 100ms for better responsiveness
  };

  const scanForQRCode = async () => {
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!video || !canvas || video.readyState !== 4) {
        return;
      }

      const context = canvas.getContext('2d');
      
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (canvas.width === 0 || canvas.height === 0) {
        return;
      }
      
      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data for QR scanning
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Use jsQR to detect QR codes
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      // Update scan attempts counter
      setScanAttempts(prev => prev + 1);
      
      if (qrCode) {
        console.log('🎉 QR Code detected!');
        console.log('📄 QR Code data:', qrCode.data);
        console.log('📍 QR Code location:', qrCode.location);
        
        // Set detected QR for visual feedback
        setDetectedQR({
          data: qrCode.data,
          location: qrCode.location
        });
        
        // Process the QR code
        handleQRDetected(qrCode.data, qrCode);
      }
      
    } catch (err) {
      console.warn('⚠️ QR scan error:', err);
    }
  };

  const handleQRDetected = (qrData, qrResult) => {
    console.log('🎯 Processing QR code:', qrData);
    
    // Validate QR code data (should be merchant payment data)
    try {
      // Try to parse as JSON (for structured payment data)
      let parsedData;
      try {
        parsedData = JSON.parse(qrData);
        console.log('📊 Parsed QR data:', parsedData);
        
        // Validate merchant QR structure
        if (parsedData.merchantId || parsedData.merchant_id) {
          console.log('✅ Valid merchant QR code detected');
          setLastScannedCode(qrData);
          
          // Stop scanning and process payment
          setTimeout(() => {
            stopCamera();
            if (onSuccess) {
              onSuccess(qrData, { text: qrData, location: qrResult.location });
            }
          }, 500);
          return;
        }
      } catch (parseErr) {
        // Not JSON, could be plain text or URL
        console.log('📝 QR contains plain text:', qrData);
      }
      
      // Check if it's a URL that might contain payment info
      if (qrData.includes('merchant') || qrData.includes('payment') || qrData.includes('pay')) {
        console.log('🔗 Payment-related QR detected');
        setLastScannedCode(qrData);
        
        setTimeout(() => {
          stopCamera();
          if (onSuccess) {
            onSuccess(qrData, { text: qrData, location: qrResult.location });
          }
        }, 500);
        return;
      }
      
      // For any other QR code, still process it (flexible for different formats)
      console.log('📄 Generic QR code detected');
      setLastScannedCode(qrData);
      
      setTimeout(() => {
        stopCamera();
        if (onSuccess) {
          onSuccess(qrData, { text: qrData, location: qrResult.location });
        }
      }, 500);
      
    } catch (err) {
      console.error('❌ Error processing QR code:', err);
      setError('Invalid QR code format');
    }
  };

  const stopCamera = () => {
    console.log('⏹️ Stopping camera...');
    
    // Clear scanning interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped camera track');
      });
      streamRef.current = null;
    }
    
    // Clear video element
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    
    setIsScanning(false);
    setScannerReady(false);
    setDetectedQR(null);
  };

  const handleManualScan = () => {
    // For testing - simulate a successful merchant QR scan
    const testMerchantQR = JSON.stringify({
      merchantId: "MERCHANT_ABC123",
      merchantName: "Test Coffee Shop",
      amount: 150,
      reference: "ORDER_" + Date.now(),
      timestamp: new Date().toISOString(),
      currency: "KES"
    });
    
    console.log('🧪 Simulating merchant QR scan:', testMerchantQR);
    setLastScannedCode(testMerchantQR);
    
    if (onSuccess) {
      onSuccess(testMerchantQR, { text: testMerchantQR });
    }
  };

  const handleRetry = () => {
    console.log('🔄 Retrying camera setup');
    stopCamera();
    setError('');
    setCameraPermission(null);
    setLastScannedCode('');
    setScanAttempts(0);
    setDetectedQR(null);
    
    setTimeout(() => {
      checkCameraSupport();
    }, 1000);
  };

  return (
    <div className="qr-scanner-container w-full max-w-md mx-auto">
      {/* Debug Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs">
        <p><strong>Scanner Status:</strong></p>
        <p>Permission: {cameraPermission || 'Checking...'}</p>
        <p>Scanning: {isScanning ? 'Yes' : 'No'}</p>
        <p>Ready: {scannerReady ? 'Yes' : 'No'}</p>
        <p>Scan Attempts: {scanAttempts}</p>
        <p>QR Detected: {detectedQR ? 'Yes' : 'No'}</p>
        <p>Browser: {navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Other'}</p>
      </div>

      {/* QR Detection Feedback */}
      {detectedQR && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500 animate-pulse"></div>
            <span className="text-yellow-700 text-sm font-medium">QR Code Detected!</span>
          </div>
          <p className="text-yellow-600 text-xs font-mono break-all">{detectedQR.data}</p>
        </div>
      )}

      {/* Last Scanned Code */}
      {lastScannedCode && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-green-700 text-sm font-medium">Successfully Scanned</span>
          </div>
          <p className="text-green-600 text-xs font-mono break-all">{lastScannedCode}</p>
        </div>
      )}

      {cameraPermission === 'denied' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <span className="text-orange-700 text-sm font-medium">Camera Access Required</span>
          </div>
          <p className="text-orange-600 text-sm mt-2">
            Please allow camera access to scan QR codes
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 transition-colors"
            >
              Refresh Page
            </button>
            <button
              onClick={handleRetry}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-red-700 text-sm font-medium">Camera Error</span>
          </div>
          <p className="text-red-600 text-sm mt-2">{error}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleRetry}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {scannerReady && !detectedQR && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="text-center">
            <h4 className="text-blue-800 font-medium text-sm mb-2">📱 Scanning for QR Codes</h4>
            <p className="text-blue-600 text-xs mb-3">
              Point your camera at a merchant's QR code to make a payment
            </p>
            <div className="flex items-center justify-center gap-2 text-blue-600 text-xs">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span>Actively scanning... ({scanAttempts} attempts)</span>
            </div>
          </div>
        </div>
      )}

      {scannerReady && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="text-center">
            <h4 className="text-green-800 font-medium text-sm mb-2">📱 Camera Active</h4>
            <p className="text-green-600 text-xs mb-3">
              Hold merchant's QR code steady in the white square
            </p>
            <button
              onClick={handleManualScan}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              🧪 Test Merchant QR
            </button>
          </div>
        </div>
      )}

      {/* Camera Container */}
      <div className="scanner-wrapper bg-black rounded-xl overflow-hidden relative">
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '400px',
            objectFit: 'cover',
            background: '#000'
          }}
          playsInline
          muted
          autoPlay
        />
        
        {/* Hidden canvas for QR processing */}
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
        
        {/* QR Scanner Overlay */}
        {scannerReady && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Scanner guide */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className={`border-2 border-dashed bg-transparent transition-colors duration-300 ${
                  detectedQR ? 'border-green-400 bg-green-400 bg-opacity-20' : 'border-white'
                }`}
                style={{
                  width: '250px',
                  height: '250px',
                  borderRadius: '12px'
                }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <p className={`text-sm px-2 py-1 rounded transition-colors ${
                    detectedQR 
                      ? 'text-green-100 bg-green-600 bg-opacity-70' 
                      : 'text-white bg-black bg-opacity-50'
                  }`}>
                    {detectedQR ? '✅ QR Code Found!' : 'Point QR code here'}
                  </p>
                </div>
              </div>
            </div>

            {/* Scanning animation */}
            {scannerReady && !detectedQR && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="absolute border-t-2 border-blue-400 bg-blue-400 bg-opacity-20"
                  style={{
                    width: '250px',
                    height: '2px',
                    animation: 'scan 2s linear infinite'
                  }}
                />
              </div>
            )}
          </div>
        )}
        
        {/* Loading overlay */}
        {isScanning && !scannerReady && !error && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium">Starting Camera...</p>
              <p className="text-sm opacity-75 mt-1">Please allow camera access</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {isScanning && scannerReady && !error && (
        <div className="text-center mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="text-green-700 text-sm font-medium mb-1">
              ✅ Ready to Scan Merchant QR Codes
            </div>
            <p className="text-green-600 text-xs">
              Position the merchant's QR code in the white square above
            </p>
          </div>
          
          <div className="flex gap-2 justify-center">
            <button
              onClick={stopCamera}
              className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Stop Scanner
            </button>
            <button
              onClick={handleManualScan}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test Payment
            </button>
          </div>
        </div>
      )}

      {/* Ready to Start */}
      {!isScanning && !error && cameraPermission === 'granted' && (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Scan Merchant QR Code</h3>
          <p className="text-gray-600 text-sm mb-6">
            Ready to scan a merchant's QR code for payment
          </p>
          <button
            onClick={startCamera}
            className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium text-lg"
          >
            📷 Start Scanner
          </button>
        </div>
      )}

      {/* Loading Permission Check */}
      {cameraPermission === null && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
          </div>
          <p className="text-gray-600 text-sm">Checking camera availability...</p>
        </div>
      )}

      <style jsx>{`
        @keyframes scan {
          0% {
            transform: translateY(-125px);
          }
          100% {
            transform: translateY(125px);
          }
        }
      `}</style>
    </div>
  );
}

export default QRScannerCamera;