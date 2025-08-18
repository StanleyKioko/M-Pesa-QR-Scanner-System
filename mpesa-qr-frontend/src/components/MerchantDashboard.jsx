import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import Input from './ui/Input';
import { 
  DollarSign, 
  Users, 
  CheckCircle, 
  Clock, 
  ArrowLeft, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Download,
  BarChart3,
  AlertCircle,
  LogOut,
  User,
  QrCode,
  Home,
  ChevronDown,
  Bug, // NEW: Debug icon
  Database // NEW: Database icon
} from 'lucide-react';
import { API_BASE_URL, STATUS } from '../utility/constants';
import axios from 'axios';

const MerchantDashboard = ({ 
  onBack, 
  onLogout, 
  onNavigateToLanding, 
  onNavigateToScanner, 
  user, 
  token 
}) => {
  const [transactions, setTransactions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [debugData, setDebugData] = useState(null); // NEW: Debug data state
  const [showDebug, setShowDebug] = useState(false); // NEW: Debug panel toggle
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalTransactions: 0,
    successfulPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    successRate: 0
  });
  const [loading, setLoading] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false); // NEW: Debug loading state
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: ''
  });

  useEffect(() => {
    if (user && token) {
      fetchAnalytics();
    }
  }, [user, token, dateFilter, statusFilter, customDateRange]);

  const fetchAnalytics = async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      
      if (dateFilter && dateFilter !== 'all') {
        params.append('period', dateFilter);
      }
      
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      if (dateFilter === 'custom' && customDateRange.start && customDateRange.end) {
        params.append('startDate', customDateRange.start);
        params.append('endDate', customDateRange.end);
      }

      const queryString = params.toString();
      const url = `${API_BASE_URL}/transactions/analytics${queryString ? '?' + queryString : ''}`;
      
      console.log('🔍 Fetching analytics from:', url);
      console.log('🔑 Using token:', token ? 'Present' : 'Missing');

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📊 Analytics response:', response.data);

      if (response.data.status === 'success') {
        const analyticsData = response.data.analytics;
        setAnalytics(analyticsData);
        
        // Update stats from analytics
        setStats({
          totalAmount: analyticsData.summary.totalRevenue,
          totalTransactions: analyticsData.summary.totalTransactions,
          successfulPayments: analyticsData.summary.successfulTransactions,
          pendingPayments: analyticsData.summary.pendingTransactions,
          failedPayments: analyticsData.summary.failedTransactions,
          successRate: analyticsData.summary.successRate
        });

        // ✅ ENHANCED: Log detailed analytics for debugging
        console.log('📈 Analytics Summary:', analyticsData.summary);
        console.log('📋 Transactions found:', analyticsData.transactions?.length || 0);
      }
    } catch (error) {
      console.error('💥 Analytics fetch error:', error);
      console.error('📋 Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      setError(`Failed to load analytics data: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Debug function to check data consistency
  const fetchDebugData = async () => {
    if (!token) return;

    setDebugLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/transactions/debug`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🐛 Debug response:', response.data);
      
      if (response.data.status === 'success') {
        setDebugData(response.data.debug);
        setShowDebug(true);
      }
    } catch (error) {
      console.error('💥 Debug fetch error:', error);
      setError(`Debug failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setDebugLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAnalytics();
    if (showDebug) {
      fetchDebugData();
    }
  };

  const handleFilterChange = (filterType, value) => {
    if (filterType === 'dateFilter') {
      setDateFilter(value);
      if (value !== 'custom') {
        setCustomDateRange({ start: '', end: '' });
      }
    } else if (filterType === 'statusFilter') {
      setStatusFilter(value);
    }
  };

  const handleCustomDateChange = (field, value) => {
    setCustomDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStatusBadge = (status) => {
    const variants = {
      success: 'success',
      pending: 'warning',
      failed: 'error',
      error: 'error'
    };
    
    const labels = {
      success: 'Success',
      pending: 'Pending',
      failed: 'Failed',
      error: 'Error'
    };

    return (
      <Badge variant={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatCurrency = (amount) => {
    return `KSH ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      // Handle Firestore timestamp
      if (dateString.seconds) {
        return new Date(dateString.seconds * 1000).toLocaleDateString('en-KE', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      return new Date(dateString).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const exportData = () => {
    if (!analytics?.transactions) return;
    
    const csvContent = [
      ['Phone', 'Amount', 'Status', 'Date', 'Reference'],
      ...analytics.transactions.map(t => [
        t.phoneNumber,
        t.amount,
        t.status,
        formatDate(t.createdAt),
        t.transactionRef || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${dateFilter}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    if (onLogout) {
      console.log('🚪 Dashboard logout clicked');
      onLogout();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header with Navigation */}
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
              <h1 className="font-semibold">Merchant Dashboard</h1>
              <p className="text-sm text-blue-100">
                Welcome, {user?.displayName || user?.name || user?.email || 'Merchant'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* User Info */}
            <div className="hidden md:flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              <span>{user?.email}</span>
            </div>

            {/* NEW: Debug Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!showDebug) {
                  fetchDebugData();
                } else {
                  setShowDebug(false);
                }
              }}
              disabled={debugLoading}
              className="text-white hover:bg-blue-700"
              title="Debug Data"
            >
              {debugLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Bug className="w-5 h-5" />
              )}
            </Button>
            
            {/* Filter Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="text-white hover:bg-blue-700"
            >
              <Filter className="w-5 h-5" />
            </Button>
            
            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
              className="text-white hover:bg-blue-700"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
            {/* Navigation Dropdown */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNavMenu(!showNavMenu)}
                className="text-white hover:bg-blue-700"
              >
                <ChevronDown className="w-5 h-5" />
              </Button>
              
              {showNavMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                  {/* Scanner Option */}
                  {onNavigateToScanner && (
                    <button
                      onClick={() => {
                        setShowNavMenu(false);
                        onNavigateToScanner();
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <QrCode className="w-4 h-4" />
                      QR Scanner
                    </button>
                  )}
                  
                  {/* Landing Page Option */}
                  {onNavigateToLanding && (
                    <button
                      onClick={() => {
                        setShowNavMenu(false);
                        onNavigateToLanding();
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Home className="w-4 h-4" />
                      Back to Landing
                    </button>
                  )}
                  
                  {/* Logout Option */}
                  <button
                    onClick={() => {
                      setShowNavMenu(false);
                      handleLogout();
                    }}
                    className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {error && (
          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center text-red-600">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </div>
            </CardContent>
          </Card>
        )}

        {/* NEW: Debug Panel */}
        {showDebug && debugData && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <Database className="w-5 h-5" />
                Debug Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Database Stats</h4>
                  <div className="space-y-1 text-sm">
                    <div>Total DB Records: <span className="font-mono">{debugData.totalTransactions}</span></div>
                    <div>Your Transactions: <span className="font-mono">{debugData.merchantTransactions}</span></div>
                    <div>Your Merchant ID: <span className="font-mono text-xs">{debugData.merchantId}</span></div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm mb-2">Field Issues</h4>
                  <div className="space-y-1 text-sm">
                    <div className={debugData.fieldIssues.missingMerchantId > 0 ? 'text-red-600' : 'text-green-600'}>
                      Missing Merchant ID: {debugData.fieldIssues.missingMerchantId}
                    </div>
                    <div className={debugData.fieldIssues.missingCheckoutRequestID > 0 ? 'text-red-600' : 'text-green-600'}>
                      Missing Checkout ID: {debugData.fieldIssues.missingCheckoutRequestID}
                    </div>
                    <div>With Callbacks: {debugData.fieldIssues.withCallbacks}</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm mb-2">Status Breakdown</h4>
                  <div className="space-y-1 text-sm">
                    <div>Pending: <span className="text-yellow-600">{debugData.fieldIssues.pendingTransactions}</span></div>
                    <div>Successful: <span className="text-green-600">{debugData.fieldIssues.successfulTransactions}</span></div>
                  </div>
                </div>
              </div>
              
              {debugData.recentTransactions?.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-sm mb-2">Recent Transactions Sample</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-1">ID</th>
                          <th className="text-left p-1">Amount</th>
                          <th className="text-left p-1">Status</th>
                          <th className="text-left p-1">Phone</th>
                          <th className="text-left p-1">Callback?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debugData.recentTransactions.slice(0, 3).map((tx, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-1 font-mono">{tx.id.substring(0, 8)}...</td>
                            <td className="p-1">{tx.amount}</td>
                            <td className="p-1">
                              <Badge variant={tx.status === 'success' ? 'success' : tx.status === 'pending' ? 'warning' : 'error'}>
                                {tx.status}
                              </Badge>
                            </td>
                            <td className="p-1 font-mono">{tx.phoneNumber}</td>
                            <td className="p-1">{tx.hasCallbackData ? '✅' : '❌'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {onNavigateToScanner && (
            <Button
              onClick={onNavigateToScanner}
              className="flex items-center gap-2 p-6 h-auto"
            >
              <QrCode className="w-6 h-6" />
              <div className="text-left">
                <div className="font-semibold">Process Payment</div>
                <div className="text-sm opacity-90">Scan QR or enter manually</div>
              </div>
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 p-6 h-auto"
          >
            <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
            <div className="text-left">
              <div className="font-semibold">Refresh Data</div>
              <div className="text-sm opacity-70">Update analytics</div>
            </div>
          </Button>
        </div>

        {/* Rest of your existing component code remains the same... */}
        {/* Key Metrics, Filters, Status Breakdown, etc. */}

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {['all', 'today', 'week', 'month', 'custom'].map(period => (
                      <Button
                        key={period}
                        size="sm"
                        variant={dateFilter === period ? 'default' : 'outline'}
                        onClick={() => handleFilterChange('dateFilter', period)}
                        className="capitalize"
                      >
                        {period === 'all' ? 'All Time' : period}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {['all', 'success', 'pending', 'failed'].map(status => (
                      <Button
                        key={status}
                        size="sm"
                        variant={statusFilter === status ? 'default' : 'outline'}
                        onClick={() => handleFilterChange('statusFilter', status)}
                        className="capitalize"
                      >
                        {status === 'all' ? 'All' : status}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Export */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Export Data
                  </label>
                  <Button
                    onClick={exportData}
                    disabled={!analytics}
                    className="w-full"
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Custom Date Range */}
              {dateFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={customDateRange.start}
                      onChange={(e) => handleCustomDateChange('start', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={customDateRange.end}
                      onChange={(e) => handleCustomDateChange('end', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                All transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              {stats.successRate >= 80 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate}%</div>
              <p className="text-xs text-muted-foreground">
                Transaction success rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingPayments}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting completion
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600">{stats.successfulPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pendingPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failedPayments}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Summary */}
        {analytics?.dailySummary && analytics.dailySummary.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.dailySummary.map((day, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">
                      {new Date(day.date).toLocaleDateString('en-KE', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="font-bold text-green-600">{day.successful}</div>
                        <div className="text-green-700">Successful</div>
                      </div>
                      <div className="text-center p-2 bg-yellow-50 rounded">
                        <div className="font-bold text-yellow-600">{day.pending}</div>
                        <div className="text-yellow-700">Pending</div>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded">
                        <div className="font-bold text-red-600">{day.failed}</div>
                        <div className="text-red-700">Failed</div>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className="font-bold text-blue-600">
                          {formatCurrency(day.totalRevenue)}
                        </div>
                        <div className="text-blue-700">Revenue</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Recent Transactions with Better Error Handling */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p>Loading transactions...</p>
              </div>
            ) : analytics?.transactions && analytics.transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Phone Number</th>
                      <th className="text-left p-3">Amount</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.transactions.slice(0, 10).map((transaction, index) => (
                      <tr key={transaction.id || index} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-sm">
                          {transaction.phoneNumber || 'N/A'}
                        </td>
                        <td className="p-3 font-semibold">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="p-3 text-sm">
                          {getStatusBadge(transaction.status)}
                        </td>
                        <td className="p-3 text-sm text-gray-600">
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td className="p-3 text-sm font-mono">
                          {transaction.transactionRef || transaction.id?.substring(0, 8) || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No transactions found</p>
                {showDebug && debugData && (
                  <div className="mt-2 text-sm">
                    <p>Debug: {debugData.merchantTransactions} transactions in database for your merchant ID</p>
                    {debugData.merchantTransactions > 0 && (
                      <p className="text-red-500">
                        ⚠️ Transactions exist but aren't displaying. Check field consistency.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MerchantDashboard;