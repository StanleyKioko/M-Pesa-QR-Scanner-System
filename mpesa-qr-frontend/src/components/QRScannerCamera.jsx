import { useState, useRef, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function QRScannerCamera({ onSuccess, onError }) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [cameraPermission, setCameraPermission] = useState(null);
  const [scannerReady, setScannerReady] = useState(false);
  const html5QrcodeScannerRef = useRef(null);
  const isInitializing = useRef(false);

  useEffect(() => {
    checkCameraPermissions();
    
    return () => {
      cleanupScanner();
    };
  }, []);

  const checkCameraPermissions = async () => {
    try {
      // Simple permission check
      await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraPermission('granted');
    } catch (err) {
      console.error('Camera permission check failed:', err);
      setCameraPermission('denied');
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and reload the page.');
      } else {
        setError('Camera access denied or not available. Please check your browser permissions.');
      }
    }
  };

  const cleanupScanner = () => {
    if (html5QrcodeScannerRef.current) {
      try {
        html5QrcodeScannerRef.current.clear()
          .then(() => {
            html5QrcodeScannerRef.current = null;
            setScannerReady(false);
          })
          .catch((error) => {
            console.error('Error cleaning up scanner:', error);
            html5QrcodeScannerRef.current = null;
            setScannerReady(false);
          });
      } catch (err) {
        console.error('Cleanup error:', err);
        html5QrcodeScannerRef.current = null;
        setScannerReady(false);
      }
    }
  };

  const startScanning = async () => {
    if (isScanning || isInitializing.current) return;
    
    console.log('Starting QR scanner...');
    
    isInitializing.current = true;
    setIsScanning(true);
    setError('');
    setScannerReady(false);
    
    const qrReaderElement = document.getElementById('qr-reader');
    if (!qrReaderElement) {
      setError('Scanner container not found');
      setIsScanning(false);
      isInitializing.current = false;
      return;
    }

    // Clear any existing content
    qrReaderElement.innerHTML = '';
    
    try {
      // Minimal, reliable configuration
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: false, // Disable zoom for simplicity
        defaultZoomValueIfSupported: 1.0,
        rememberLastUsedCamera: true,
        // Only QR codes - most reliable
        supportedScanTypes: [0], // 0 = QR_CODE
        videoConstraints: {
          facingMode: 'environment'
        }
      };

      console.log('Initializing scanner with minimal config...');

      // Initialize scanner with delay
      setTimeout(() => {
        try {
          html5QrcodeScannerRef.current = new Html5QrcodeScanner(
            "qr-reader", 
            config, 
            false // verbose = false to reduce noise
          );

          // Success handler
          const onScanSuccess = (decodedText, decodedResult) => {
            console.log('🎉 QR Code successfully scanned!');
            console.log('Decoded text:', decodedText);
            
            // Provide immediate feedback
            setScannerReady(false);
            
            // Clean stop before callback
            if (html5QrcodeScannerRef.current) {
              html5QrcodeScannerRef.current.clear()
                .then(() => {
                  setIsScanning(false);
                  html5QrcodeScannerRef.current = null;
                  isInitializing.current = false;
                  
                  // Success callback
                  if (onSuccess) {
                    onSuccess(decodedText, decodedResult);
                  }
                })
                .catch(err => {
                  console.error('Error stopping scanner after success:', err);
                  setIsScanning(false);
                  html5QrcodeScannerRef.current = null;
                  isInitializing.current = false;
                  
                  if (onSuccess) {
                    onSuccess(decodedText, decodedResult);
                  }
                });
            }
          };

          // Simplified error handler
          const onScanFailure = (error) => {
            // Ignore routine scanning errors - don't log them
            if (error.includes('NotFoundException') || 
                error.includes('No QR code found') ||
                error.includes('NotFoundError') ||
                error.includes('QR code parse error')) {
              return; // Silent continue
            }
            
            // Log other errors but don't stop scanning
            console.warn('Non-critical scan error:', error);
          };

          console.log('Rendering QR scanner...');
          
          // Render the scanner
          html5QrcodeScannerRef.current.render(onScanSuccess, onScanFailure);
          
          // Mark ready after delay
          setTimeout(() => {
            console.log('Scanner ready for scanning');
            setScannerReady(true);
            isInitializing.current = false;
          }, 2000);

        } catch (initError) {
          console.error('Scanner initialization error:', initError);
          setError(`Failed to start scanner: ${initError.message}`);
          setIsScanning(false);
          isInitializing.current = false;
          
          if (onError) {
            onError(initError);
          }
        }
      }, 1000);

    } catch (err) {
      console.error('Scanner setup error:', err);
      setError(`Scanner setup failed: ${err.message}`);
      setIsScanning(false);
      isInitializing.current = false;
      
      if (onError) {
        onError(err);
      }
    }
  };

  const stopScanning = () => {
    console.log('Stopping scanner...');
    
    if (html5QrcodeScannerRef.current) {
      html5QrcodeScannerRef.current.clear()
        .then(() => {
          console.log('Scanner stopped');
          setIsScanning(false);
          setScannerReady(false);
          html5QrcodeScannerRef.current = null;
          isInitializing.current = false;
        })
        .catch((error) => {
          console.error('Error stopping scanner:', error);
          setIsScanning(false);
          setScannerReady(false);
          html5QrcodeScannerRef.current = null;
          isInitializing.current = false;
        });
    } else {
      setIsScanning(false);
      setScannerReady(false);
      isInitializing.current = false;
    }
  };

  const handleRetry = () => {
    setError('');
    setCameraPermission(null);
    setScannerReady(false);
    checkCameraPermissions();
  };

  const requestCameraPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraPermission('granted');
      setError('');
    } catch (err) {
      console.error('Camera permission denied:', err);
      setCameraPermission('denied');
      setError('Camera permission required to scan QR codes.');
    }
  };

  return (
    <div className="qr-scanner-container w-full max-w-md mx-auto">
      {/* Camera Permission Request */}
      {cameraPermission === 'denied' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-orange-500"></div>
            <span className="text-orange-700 text-sm font-medium">Camera Access Required</span>
          </div>
          <p className="text-orange-600 text-sm mt-2">
            Please allow camera access to scan QR codes
          </p>
          <button
            onClick={requestCameraPermission}
            className="mt-3 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 transition-colors"
          >
            Allow Camera Access
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-red-700 text-sm font-medium">Scanner Error</span>
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
              onClick={requestCameraPermission}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              Check Permissions
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {scannerReady && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="text-center">
            <h4 className="text-blue-800 font-medium text-sm mb-2">📱 Scanning Tips</h4>
            <ul className="text-blue-700 text-xs space-y-1 text-left">
              <li>• Hold device steady</li>
              <li>• Ensure good lighting</li>
              <li>• Position QR code in center</li>
              <li>• Keep QR code fully visible</li>
            </ul>
          </div>
        </div>
      )}

      {/* Scanner Container */}
      <div className="scanner-wrapper bg-gray-900 rounded-xl overflow-hidden relative">
        <div 
          id="qr-reader" 
          style={{ 
            width: '100%',
            minHeight: '350px',
            border: 'none'
          }}
        ></div>
        
        {/* Loading overlay */}
        {isScanning && !scannerReady && !error && (
          <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-10">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium">Initializing Scanner...</p>
              <p className="text-sm opacity-75 mt-1">Please wait</p>
            </div>
          </div>
        )}

        {/* Scanning overlay */}
        {isScanning && scannerReady && !error && (
          <div className="absolute top-4 left-4 right-4 bg-green-600 bg-opacity-90 rounded-lg p-3 z-10">
            <div className="text-center text-white">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Scanner Active</span>
              </div>
              <p className="text-xs opacity-90">
                Point camera at QR code
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {isScanning && scannerReady && !error && cameraPermission === 'granted' && (
        <div className="text-center mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <div className="text-green-700 text-sm font-medium mb-1">
              ✅ Ready to Scan
            </div>
            <p className="text-green-600 text-xs">
              Scanner is active and looking for QR codes
            </p>
          </div>
          
          <button
            onClick={stopScanning}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Stop Scanner
          </button>
        </div>
      )}

      {/* Initializing Status */}
      {isScanning && !scannerReady && !error && cameraPermission === 'granted' && (
        <div className="text-center mt-4">
          <div className="inline-flex items-center gap-2 text-blue-600 text-sm">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <span>Starting scanner...</span>
          </div>
        </div>
      )}

      {/* Ready to Start */}
      {!isScanning && !error && cameraPermission === 'granted' && (
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-4.01M12 12v4m-4-4h4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">QR Scanner Ready</h3>
          <p className="text-gray-600 text-sm mb-6">
            Tap to start scanning QR codes
          </p>
          <button
            onClick={startScanning}
            className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium text-lg"
          >
            📷 Start Scanning
          </button>
        </div>
      )}

      {/* Loading Permission Check */}
      {cameraPermission === null && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
          </div>
          <p className="text-gray-600 text-sm">Checking camera permissions...</p>
        </div>
      )}
    </div>
  );
}

export default QRScannerCamera;