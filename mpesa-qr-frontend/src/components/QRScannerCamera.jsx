import { useState, useRef, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function QRScannerCamera({ onScanSuccess, onScanError }) {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const startScanning = () => {
    setIsScanning(true);
    
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
      showZoomSliderIfSupported: true,
      defaultZoomValueIfSupported: 1.0,
    };

    html5QrcodeScannerRef.current = new Html5QrcodeScanner(
      "qr-reader", 
      config, 
      false
    );

    html5QrcodeScannerRef.current.render(
      (decodedText, decodedResult) => {
        console.log('QR Code scanned:', decodedText);
        onScanSuccess(decodedText, decodedResult);
        stopScanning();
      },
      (error) => {
        // Handle scan errors silently during continuous scanning
        if (error.includes('NotFoundException')) {
          return; // QR not found, continue scanning
        }
        console.error('QR scan error:', error);
        onScanError(error);
      }
    );
  };

  const stopScanning = () => {
    if (html5QrcodeScannerRef.current) {
      html5QrcodeScannerRef.current.clear().then(() => {
        setIsScanning(false);
      }).catch(console.error);
    }
  };

  return (
    <div className="qr-scanner-container">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold mb-2">QR Code Scanner</h3>
        {!isScanning ? (
          <button
            onClick={startScanning}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Start Camera Scan
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
          >
            Stop Scanning
          </button>
        )}
      </div>
      
      {isScanning && (
        <div className="scanner-wrapper">
          <div id="qr-reader" style={{ width: '100%' }}></div>
          <p className="text-sm text-gray-600 mt-2 text-center">
            Point your camera at a QR code to scan payment details
          </p>
        </div>
      )}
    </div>
  );
}

export default QRScannerCamera;