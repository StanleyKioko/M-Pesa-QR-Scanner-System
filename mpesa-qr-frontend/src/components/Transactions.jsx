import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { ArrowLeft, RefreshCw, Download, Eye, Calendar, Phone, DollarSign } from 'lucide-react';
import { API_BASE_URL, API_ENDPOINTS, STATUS } from '../utility/constants';
import axios from 'axios';

function Transactions({ token, user, onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTransactions = async () => {
    if (!token) {
      setError('Please login to view transactions');
      setLoading(false);
      return;
    }

    try {
      setError('');
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.TRANSACTIONS}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.status === 'success') {
        setTransactions(response.data.transactions || []);
      } else {
        setError('Failed to fetch transactions');
      }
    } catch (err) {
      console.error('Fetch transactions error:', err);
      setError(err.response?.data?.error || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [token]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
  };

  const getStatusBadge = (status) => {
    const variants = {
      [STATUS.SUCCESS]: 'success',
      [STATUS.PENDING]: 'warning', 
      [STATUS.FAILED]: 'error',
      [STATUS.ERROR]: 'error'
    };

    const labels = {
      [STATUS.SUCCESS]: 'Completed',
      [STATUS.PENDING]: 'Pending',
      [STATUS.FAILED]: 'Failed',
      [STATUS.ERROR]: 'Error'
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
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp.seconds) {
      // Firestore timestamp
      date = new Date(timestamp.seconds * 1000);
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

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50">
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
            <h1 className="font-semibold">Transactions</h1>
          </div>
        </div>
        <div className="container mx-auto p-4">
          <Card className="border-red-500">
            <CardContent className="p-4">
              <p className="text-center text-red-600">Please login to view transactions</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="text-white hover:bg-blue-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="font-semibold">Transaction History</h1>
              <p className="text-sm text-blue-100">
                {user?.email || 'Merchant Dashboard'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-white hover:bg-blue-700"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="container mx-auto p-4">
        {loading ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p>Loading transactions...</p>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-red-500">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={handleRefresh} variant="outline">
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : transactions.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No Transactions Yet</h3>
                <p className="text-gray-500">Your payment transactions will appear here once you start processing payments.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Transaction Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {transactions.filter(t => t.status === STATUS.SUCCESS).length}
                    </p>
                    <p className="text-sm text-gray-600">Successful</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {transactions.filter(t => t.status === STATUS.PENDING).length}
                    </p>
                    <p className="text-sm text-gray-600">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {transactions.filter(t => [STATUS.FAILED, STATUS.ERROR].includes(t.status)).length}
                    </p>
                    <p className="text-sm text-gray-600">Failed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(
                        transactions
                          .filter(t => t.status === STATUS.SUCCESS)
                          .reduce((sum, t) => sum + (t.amount || 0), 0)
                      )}
                    </p>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transactions List */}
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">
                              {transaction.phoneNumber || 'N/A'}
                            </span>
                          </div>
                          {getStatusBadge(transaction.status)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Amount: </span>
                            <span className="text-green-600 font-semibold">
                              {formatCurrency(transaction.amount || 0)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Ref: </span>
                            <span className="font-mono text-xs">
                              {transaction.transactionRef || transaction.id}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Date: </span>
                            <span>{formatDate(transaction.createdAt)}</span>
                          </div>
                          <div>
                            <span className="font-medium">Description: </span>
                            <span>{transaction.description || 'QR Payment'}</span>
                          </div>
                        </div>

                        {/* Additional details for successful payments */}
                        {transaction.status === STATUS.SUCCESS && transaction.paymentDetails && (
                          <div className="mt-2 text-xs text-gray-500">
                            <span className="font-medium">M-Pesa Receipt: </span>
                            <span className="font-mono">
                              {transaction.paymentDetails.mpesaReceiptNumber}
                            </span>
                          </div>
                        )}

                        {/* Error message for failed transactions */}
                        {(transaction.status === STATUS.FAILED || transaction.status === STATUS.ERROR) && transaction.error && (
                          <div className="mt-2 text-xs text-red-600">
                            <span className="font-medium">Error: </span>
                            <span>{transaction.error}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-4">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Transactions;