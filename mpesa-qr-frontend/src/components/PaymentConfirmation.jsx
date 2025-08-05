import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowLeft, 
  RefreshCw,
  Phone,
  DollarSign,
  Calendar,
  User,
  Hash,
  MessageSquare
} from 'lucide-react';
import { STATUS, API_BASE_URL } from '../utility/constants';
import axios from 'axios';

const PaymentConfirmation = ({ paymentData, onBack, onNewPayment, token }) => {
  const [status, setStatus] = useState(paymentData?.status || STATUS.PENDING);
  const [loading, setLoading] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState(paymentData);

  // Real status checking from backend with proper polling
  useEffect(() => {
    let pollInterval;
    let timeoutId;

    const pollTransactionStatus = async () => {
      if (!transactionDetails?.transactionId || !token) {
        return;
      }

      try {
        const response = await axios.get(
          `${API_BASE_URL}/transactions/${transactionDetails.transactionId}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data.transaction) {
          const transaction = response.data.transaction;
          const newStatus = transaction.status;
          
          console.log('Status update:', {
            oldStatus: status,
            newStatus,
            transaction: transaction
          });

          setStatus(newStatus);
          setTransactionDetails(prev => ({
            ...prev,
            ...transaction,
            customerMessage: transaction.mpesaResponse?.CustomerMessage || 
                           transaction.callbackData?.CustomerMessage ||
                           prev.customerMessage
          }));

          // Stop polling if payment is complete (success, failed, or cancelled)
          if (['success', 'failed', 'cancelled', 'error'].includes(newStatus)) {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }
      } catch (error) {
        console.error('Error polling transaction status:', error);
        // Don't stop polling on error, continue trying
      }
    };

    // Only poll for pending transactions
    if (status === STATUS.PENDING && transactionDetails?.transactionId && token) {
      // Initial check after 3 seconds
      timeoutId = setTimeout(pollTransactionStatus, 3000);
      
      // Then poll every 5 seconds
      pollInterval = setInterval(pollTransactionStatus, 5000);

      // Stop polling after 5 minutes (timeout)
      const stopPollingTimeout = setTimeout(() => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        setStatus('failed');
        setTransactionDetails(prev => ({
          ...prev,
          error: 'Payment timeout',
          customerMessage: 'Payment timed out. Please try again.'
        }));
      }, 300000); // 5 minutes

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (pollInterval) clearInterval(pollInterval);
        if (stopPollingTimeout) clearTimeout(stopPollingTimeout);
      };
    }
  }, [status, transactionDetails?.transactionId, token]);

  const getStatusDisplay = () => {
    switch (status) {
      case STATUS.SUCCESS:
        return {
          icon: <CheckCircle className="w-16 h-16 text-green-500" />,
          title: 'Payment Successful!',
          description: 'Your M-Pesa payment has been processed successfully.',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-500',
          textColor: 'text-green-700'
        };
      case STATUS.FAILED:
        return {
          icon: <XCircle className="w-16 h-16 text-red-500" />,
          title: 'Payment Failed',
          description: 'Your payment could not be processed. Please try again.',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-500',
          textColor: 'text-red-700'
        };
      case STATUS.CANCELLED:
        return {
          icon: <XCircle className="w-16 h-16 text-orange-500" />,
          title: 'Payment Cancelled',
          description: 'You cancelled the payment on your phone.',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-500',
          textColor: 'text-orange-700'
        };
      case STATUS.PENDING:
      default:
        return {
          icon: <Clock className="w-16 h-16 text-yellow-500 animate-pulse" />,
          title: 'Payment Pending',
          description: 'Please check your phone and enter your M-Pesa PIN to complete the payment.',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-500',
          textColor: 'text-yellow-700'
        };
    }
  };

  const getStatusBadge = () => {
    const variants = {
      [STATUS.SUCCESS]: 'success',
      [STATUS.PENDING]: 'warning',
      [STATUS.FAILED]: 'error',
      [STATUS.CANCELLED]: 'secondary'
    };

    const labels = {
      [STATUS.SUCCESS]: 'Completed',
      [STATUS.PENDING]: 'Pending',
      [STATUS.FAILED]: 'Failed',
      [STATUS.CANCELLED]: 'Cancelled'
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp._seconds) {
      // Firestore timestamp
      date = new Date(timestamp._seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRefreshStatus = async () => {
    if (!transactionDetails?.transactionId || !token) {
      console.log('No transaction ID or token available');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/transactions/${transactionDetails.transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.transaction) {
        const transaction = response.data.transaction;
        setStatus(transaction.status);
        setTransactionDetails(prev => ({
          ...prev,
          ...transaction,
          customerMessage: transaction.mpesaResponse?.CustomerMessage || 
                         transaction.callbackData?.CustomerMessage || 
                         prev.customerMessage
        }));
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusDisplay = getStatusDisplay();

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
            <h1 className="font-semibold">Payment Confirmation</h1>
            <p className="text-sm text-blue-100">Transaction details</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Status Card */}
        <Card className={`${statusDisplay.borderColor} ${statusDisplay.bgColor}`}>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              {statusDisplay.icon}
              <div>
                <h2 className={`text-2xl font-bold ${statusDisplay.textColor}`}>
                  {statusDisplay.title}
                </h2>
                <p className={`text-sm ${statusDisplay.textColor} mt-2`}>
                  {statusDisplay.description}
                </p>
              </div>
              
              {status === STATUS.PENDING && (
                <div className="flex justify-center">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleRefreshStatus}
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Check Status
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payment Details</CardTitle>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Merchant</p>
                  <p className="font-medium">
                    {transactionDetails?.merchantName || 'QR Merchant'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="font-medium text-lg">
                    {formatCurrency(transactionDetails?.amount)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Phone className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone Number</p>
                  <p className="font-medium">
                    {transactionDetails?.phoneNumber || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date & Time</p>
                  <p className="font-medium">
                    {formatDate(transactionDetails?.timestamp || transactionDetails?.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction Reference */}
            {transactionDetails?.transactionRef && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Hash className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Transaction Reference</p>
                  <p className="font-mono text-sm">
                    {transactionDetails.transactionRef}
                  </p>
                </div>
              </div>
            )}

            {/* M-Pesa Receipt Number */}
            {transactionDetails?.paymentDetails?.mpesaReceiptNumber && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Hash className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">M-Pesa Receipt</p>
                  <p className="font-mono text-sm">
                    {transactionDetails.paymentDetails.mpesaReceiptNumber}
                  </p>
                </div>
              </div>
            )}

            {/* Customer Message from M-Pesa */}
            {transactionDetails?.customerMessage && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">M-Pesa Message</p>
                  <p className="text-sm">
                    {transactionDetails.customerMessage}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {status === STATUS.SUCCESS && (
            <Button 
              onClick={onNewPayment} 
              className="w-full" 
              variant="success"
            >
              Make Another Payment
            </Button>
          )}
          
          {(status === STATUS.FAILED || status === STATUS.CANCELLED) && (
            <Button 
              onClick={onBack} 
              className="w-full" 
              variant="destructive"
            >
              Try Again
            </Button>
          )}
          
          {status === STATUS.PENDING && (
            <div className="space-y-2">
              <Button 
                onClick={handleRefreshStatus}
                disabled={loading}
                className="w-full"
                variant="outline"
              >
                {loading ? 'Checking...' : 'Check Payment Status'}
              </Button>
              <Button 
                onClick={onBack} 
                className="w-full" 
                variant="ghost"
              >
                Cancel Payment
              </Button>
            </div>
          )}

          <Button 
            onClick={onBack} 
            className="w-full" 
            variant="outline"
          >
            Back to Scanner
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmation;