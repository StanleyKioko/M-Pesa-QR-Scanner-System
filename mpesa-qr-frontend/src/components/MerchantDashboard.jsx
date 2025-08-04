import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { DollarSign, Users, CheckCircle, Clock, ArrowLeft, RefreshCw } from 'lucide-react';
import { API_BASE_URL, STATUS } from '../utility/constants';
import axios from 'axios';

const MerchantDashboard = ({ onBack, user, token }) => {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalTransactions: 0,
    successfulPayments: 0,
    pendingPayments: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      fetchTransactions();
      // Refresh transactions every 30 seconds
      const interval = setInterval(fetchTransactions, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Transactions response:', response.data);

      if (response.data.status === 'success' && response.data.transactions) {
        const fetchedTransactions = response.data.transactions;
        setTransactions(fetchedTransactions);

        // Calculate stats
        const totalAmount = fetchedTransactions
          .filter(t => t.status === 'success')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        setStats({
          totalAmount,
          totalTransactions: fetchedTransactions.length,
          successfulPayments: fetchedTransactions.filter(t => t.status === 'success').length,
          pendingPayments: fetchedTransactions.filter(t => t.status === 'pending').length
        });
      } else {
        setTransactions([]);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.response?.data?.error || 'Failed to fetch transactions');
      // Don't clear transactions on error, keep existing data
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      success: 'success',
      pending: 'warning',
      failed: 'error'
    };
    
    const labels = {
      success: 'Success',
      pending: 'Pending',
      failed: 'Failed'
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

  const handleRefresh = () => {
    fetchTransactions();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
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
              <h1 className="font-semibold">Merchant Dashboard</h1>
              <p className="text-sm text-blue-100">
                Welcome, {user?.displayName || user?.email || 'Merchant'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={loading}
            className="text-white hover:bg-blue-700"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
              <p className="text-xs text-muted-foreground">
                From successful payments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTransactions}</div>
              <p className="text-xs text-muted-foreground">
                All time transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful Payments</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successfulPayments}</div>
              <p className="text-xs text-muted-foreground">
                Completed transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingPayments}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting completion
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && transactions.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No transactions found.</p>
                <p className="text-sm text-gray-400 mt-1">
                  Transactions will appear here once customers start paying via QR codes.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left font-medium text-gray-900">Transaction ID</th>
                      <th className="p-3 text-left font-medium text-gray-900">Phone Number</th>
                      <th className="p-3 text-left font-medium text-gray-900">Amount</th>
                      <th className="p-3 text-left font-medium text-gray-900">Status</th>
                      <th className="p-3 text-left font-medium text-gray-900">Date</th>
                      <th className="p-3 text-left font-medium text-gray-900">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50">
                        <td className="p-3 text-sm font-mono">{transaction.id.slice(-8)}</td>
                        <td className="p-3 text-sm">{transaction.phoneNumber}</td>
                        <td className="p-3 text-sm font-medium">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="p-3 text-sm">
                          {getStatusBadge(transaction.status)}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td className="p-3 text-sm font-mono">
                          {transaction.transactionRef || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MerchantDashboard;