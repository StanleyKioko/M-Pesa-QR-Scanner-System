/**
 * Parse QR code data to extract payment information
 * Supports multiple QR formats commonly used for payments
 */
export function parseQRCode(qrData) {
  try {
    // Try to parse as JSON first (custom QR format)
    if (qrData.startsWith('{') && qrData.endsWith('}')) {
      const parsed = JSON.parse(qrData);
      return {
        type: 'json',
        phoneNumber: parsed.phone || parsed.phoneNumber || '',
        amount: parsed.amount || '',
        reference: parsed.reference || parsed.ref || '',
        description: parsed.description || parsed.desc || 'QR Payment',
        merchantId: parsed.merchantId || '',
        isValid: !!(parsed.phone || parsed.phoneNumber) && !!parsed.amount
      };
    }

    // Parse URL format (like payment links)
    if (qrData.startsWith('http') || qrData.startsWith('https')) {
      const url = new URL(qrData);
      const params = new URLSearchParams(url.search);
      
      return {
        type: 'url',
        phoneNumber: params.get('phone') || params.get('phoneNumber') || '',
        amount: params.get('amount') || '',
        reference: params.get('reference') || params.get('ref') || '',
        description: params.get('description') || params.get('desc') || 'QR Payment',
        merchantId: params.get('merchantId') || '',
        isValid: !!(params.get('phone') || params.get('phoneNumber')) && !!params.get('amount')
      };
    }

    // Parse custom format: PHONE:AMOUNT:REFERENCE
    if (qrData.includes(':')) {
      const parts = qrData.split(':');
      if (parts.length >= 2) {
        return {
          type: 'custom',
          phoneNumber: parts[0] || '',
          amount: parts[1] || '',
          reference: parts[2] || '',
          description: parts[3] || 'QR Payment',
          merchantId: parts[4] || '',
          isValid: !!parts[0] && !!parts[1]
        };
      }
    }

    // Parse simple phone number
    if (/^254\d{9}$/.test(qrData)) {
      return {
        type: 'phone',
        phoneNumber: qrData,
        amount: '',
        reference: '',
        description: 'QR Payment',
        merchantId: '',
        isValid: true
      };
    }

    // If none of the above, treat as raw data
    return {
      type: 'raw',
      phoneNumber: '',
      amount: '',
      reference: '',
      description: 'QR Payment',
      merchantId: '',
      rawData: qrData,
      isValid: false
    };

  } catch (error) {
    console.error('Error parsing QR code:', error);
    return {
      type: 'error',
      phoneNumber: '',
      amount: '',
      reference: '',
      description: 'QR Payment',
      merchantId: '',
      rawData: qrData,
      isValid: false,
      error: error.message
    };
  }
}

/**
 * Generate a sample QR code data for testing
 */
export function generateSampleQRData() {
  return JSON.stringify({
    phone: '254708374149',
    amount: '100',
    reference: `QR_${Date.now()}`,
    description: 'Test Payment',
    merchantId: 'MERCHANT001'
  });
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone) {
  return /^254\d{9}$/.test(phone);
}

/**
 * Validate amount
 */
export function validateAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
}