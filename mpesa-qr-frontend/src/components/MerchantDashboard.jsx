import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';
import { 
  BarChart3, 
  DollarSign, 
  TrendingUp, 
  Users, 
  RefreshCw,
  Calendar,
  Download,
  Filter,
  Search,
  MoreVertical,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Menu,
  X,
  LogOut,
  Home,
  QrCode,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Activity,
  CreditCard,
  Smartphone,
  Settings,
  Plus
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../utility/constants';
import { useAuth } from '../hooks/useAuth';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MerchantDashboard = () => {
  const { user, merchantData, logout } = useAuth();
  const navigate = useNavigate();
  
  const [analytics, setAnalytics] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('week');
  const [status, setStatus] = useState('all');
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const formatCurrency = (amount) => {
    return `KSH ${parseFloat(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      success: 'success',
      pending: 'warning',
      failed: 'error',
      error: 'error'
    };
    
    return (
      <Badge variant={variants[status] || 'default'}>
        {status?.toUpperCase() || 'UNKNOWN'}
      </Badge>
    );
  };

  const downloadCSV = () => {
    if (!analytics?.transactions?.length) {
      alert('No data to download');
      return;
    }

    const headers = ['Date', 'Phone', 'Amount', 'Status', 'Reference'];
    const csvData = analytics.transactions.map(t => [
      formatDate(t.createdAt),
      t.phoneNumber || 'N/A',
      t.amount || 0,
      t.status || 'unknown',
      t.transactionRef || t.id || 'N/A'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchAnalytics = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        period,
        ...(status !== 'all' && { status }),
        limit: '100'
      });

      const response = await axios.get(
        `${API_BASE_URL}/transactions/analytics?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success') {
        setAnalytics(response.data.analytics);
        setTransactions(response.data.analytics.transactions || []);
      } else {
        setError('Failed to fetch analytics');
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDebugInfo = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/transactions/debug`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success') {
        setDebugData(response.data.debug);
      }
    } catch (err) {
      console.error('Debug fetch error:', err);
    }
  };

  const handleRefresh = () => {
    fetchAnalytics();
    if (showDebug) {
      fetchDebugInfo();
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  };
  
  const handleNavigateToQRGenerator = () => {
    navigate('/generate-qr');
  };
  
  const handleNavigateToScanner = () => {
    navigate('/payment-scanner');
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, status]);

  useEffect(() => {
    if (showDebug && !debugData) {
      fetchDebugInfo();
    }
  }, [showDebug]);

  // Calculate stats
  const stats = analytics ? {
    totalRevenue: analytics.summary?.totalRevenue || 0,
    totalTransactions: analytics.summary?.totalTransactions || 0,
    successfulPayments: analytics.summary?.successfulTransactions || 0,
    pendingPayments: analytics.summary?.pendingTransactions || 0,
    failedPayments: analytics.summary?.failedTransactions || 0,
    successRate: analytics.summary?.successRate || 0
  } : {
    totalRevenue: 0,
    totalTransactions: 0,
    successfulPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    successRate: 0
  };

  // Add dailyData for chart
  const dailyData = analytics?.dailySummaries?.map(day => ({
    date: day.dateFormatted,
    revenue: day.totalRevenue,
    successful: day.successful,
    failed: day.failed,
    pending: day.pending,
  })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Modern Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-2 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Merchant Dashboard</h1>
                <p className="text-gray-600">Welcome back, {merchantData?.name || user?.displayName || 'Merchant'}</p>
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {/* Navigation Menu */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNavMenu(!showNavMenu)}
                  className="flex items-center gap-2"
                >
                  <Menu className="w-4 h-4" />
                  Menu
                </Button>
                
                {showNavMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg py-2 z-50 border">
                    {/* QR Generator Option */}
                    <button
                      onClick={() => {
                        setShowNavMenu(false);
                        handleNavigateToQRGenerator();
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <QrCode className="w-4 h-4" />
                      Generate QR Code
                    </button>

                    {/* QR Scanner Option */}
                    <button
                      onClick={() => {
                        setShowNavMenu(false);
                        handleNavigateToScanner();
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <Smartphone className="w-4 h-4" />
                      QR Scanner
                    </button>
                    
                    <hr className="my-2" />
                    
                    {/* Logout Option */}
                    <button
                      onClick={() => {
                        setShowNavMenu(false);
                        handleLogout();
                      }}
                      className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-600" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="success">Successful</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadCSV}
                disabled={!analytics?.transactions?.length}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center gap-2"
              >
                {showDebug ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showDebug ? 'Hide' : 'Show'} Debug
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-700">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Loading analytics...</p>
            </CardContent>
          </Card>
        )}

        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Total Revenue</p>
                  <div className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
                  <p className="text-green-100 text-xs mt-1">
                    From {stats.totalTransactions} transactions
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-green-100" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Success Rate</p>
                  <div className="text-3xl font-bold">{stats.successRate}%</div>
                  <p className="text-blue-100 text-xs mt-1">
                    Transaction success rate
                  </p>
                </div>
                <TrendingUp className="h-10 w-10 text-blue-100" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm font-medium">Pending</p>
                  <div className="text-3xl font-bold">{stats.pendingPayments}</div>
                  <p className="text-yellow-100 text-xs mt-1">
                    Awaiting completion
                  </p>
                </div>
                <Clock className="h-10 w-10 text-yellow-100" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm font-medium">Failed</p>
                  <div className="text-3xl font-bold">{stats.failedPayments}</div>
                  <p className="text-red-100 text-xs mt-1">
                    Unsuccessful payments
                  </p>
                </div>
                <XCircle className="h-10 w-10 text-red-100" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Status Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Successful Payments</p>
                    <p className="text-2xl font-bold text-green-600">{stats.successfulPayments}</p>
                  </div>
                </div>
                <ArrowUp className="h-4 w-4 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-100 p-2 rounded-lg">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.pendingPayments}</p>
                  </div>
                </div>
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-red-100 p-2 rounded-lg">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Failed Payments</p>
                    <p className="text-2xl font-bold text-red-600">{stats.failedPayments}</p>
                  </div>
                </div>
                <ArrowDown className="h-4 w-4 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Quick Actions
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Chart: Revenue Trend (Last 7 Days) */}
            {dailyData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Revenue Trend (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                      <Bar dataKey="successful" fill="#22c55e" name="Successful" />
                      <Bar dataKey="failed" fill="#ef4444" name="Failed" />
                      <Bar dataKey="pending" fill="#f59e42" name="Pending" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Daily Summary */}
            {analytics?.dailySummaries?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Daily Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {analytics.dailySummaries.slice(0, 7).map((day, index) => (
                      <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-gray-900">{day.dateFormatted}</span>
                          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {day.totalTransactions} transactions
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="font-bold text-xl text-green-600">{day.successful}</div>
                            <div className="text-sm text-green-700">Successful</div>
                          </div>
                          <div className="text-center p-3 bg-yellow-50 rounded-lg">
                            <div className="font-bold text-xl text-yellow-600">{day.pending}</div>
                            <div className="text-sm text-yellow-700">Pending</div>
                          </div>
                          <div className="text-center p-3 bg-red-50 rounded-lg">
                            <div className="font-bold text-xl text-red-600">{day.failed}</div>
                            <div className="text-sm text-red-700">Failed</div>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="font-bold text-xl text-blue-600">
                              {formatCurrency(day.totalRevenue)}
                            </div>
                            <div className="text-sm text-blue-700">Revenue</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Loading transactions...</p>
                  </div>
                ) : analytics?.transactions && analytics.transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-4 font-semibold">Phone Number</th>
                          <th className="text-left p-4 font-semibold">Amount</th>
                          <th className="text-left p-4 font-semibold">Status</th>
                          <th className="text-left p-4 font-semibold">Date</th>
                          <th className="text-left p-4 font-semibold">Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.transactions.slice(0, 10).map((transaction, index) => (
                          <tr key={transaction.id || index} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-mono text-sm">
                              {transaction.phoneNumber || 'N/A'}
                            </td>
                            <td className="p-4 font-semibold">
                              {formatCurrency(transaction.amount)}
                            </td>
                            <td className="p-4">
                              {getStatusBadge(transaction.status)}
                            </td>
                            <td className="p-4 text-sm text-gray-600">
                              {formatDate(transaction.createdAt)}
                            </td>
                            <td className="p-4 text-sm font-mono">
                              {transaction.transactionRef || transaction.id?.substring(0, 8) || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-600 mb-2">No transactions found</h3>
                    <p className="text-gray-500">Your transactions will appear here once you start processing payments.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quick Actions Tab */}
          <TabsContent value="actions">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Generate QR Code */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={handleNavigateToQRGenerator}>
                <CardContent className="p-6 text-center">
                  <div className="bg-green-100 p-4 rounded-full w-fit mx-auto mb-4">
                    <QrCode className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Generate QR Code</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Create payment QR codes for your customers
                  </p>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create QR Code
                  </Button>
                </CardContent>
              </Card>

              {/* QR Scanner */}
              <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={handleNavigateToScanner}>
                <CardContent className="p-6 text-center">
                  <div className="bg-blue-100 p-4 rounded-full w-fit mx-auto mb-4">
                    <Smartphone className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">QR Scanner</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Scan QR codes to process customer payments
                  </p>
                  <Button className="w-full" variant="outline">
                    <QrCode className="w-4 h-4 mr-2" />
                    Open Scanner
                  </Button>
                </CardContent>
              </Card>

              {/* Export Data */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className="bg-purple-100 p-4 rounded-full w-fit mx-auto mb-4">
                    <Download className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Export Data</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Download your transaction data as CSV
                  </p>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={downloadCSV}
                    disabled={!analytics?.transactions?.length}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Debug Panel */}
        {showDebug && debugData && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-yellow-800 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Debug Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold text-sm mb-3 text-gray-700">Database Stats</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total DB Records:</span>
                      <span className="font-mono font-bold">{debugData.totalTransactions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Your Transactions:</span>
                      <span className="font-mono font-bold">{debugData.merchantTransactions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Your Merchant ID:</span>
                      <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                        {debugData.merchantId}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm mb-3 text-gray-700">Field Issues</h4>
                  <div className="space-y-2 text-sm">
                    <div className={`flex justify-between ${debugData.fieldIssues?.missingMerchantId > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <span>Missing Merchant ID:</span>
                      <span className="font-bold">{debugData.fieldIssues?.missingMerchantId || 0}</span>
                    </div>
                    <div className={`flex justify-between ${debugData.fieldIssues?.missingCheckoutRequestID > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <span>Missing Checkout ID:</span>
                      <span className="font-bold">{debugData.fieldIssues?.missingCheckoutRequestID || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>With Callbacks:</span>
                      <span className="font-bold">{debugData.fieldIssues?.withCallbacks || 0}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-3 text-gray-700">Status Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Pending:</span>
                      <span className="font-bold text-yellow-600">{debugData.fieldIssues?.pendingTransactions || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Successful:</span>
                      <span className="font-bold text-green-600">{debugData.fieldIssues?.successfulTransactions || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {debugData.recentTransactions?.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-sm mb-3 text-gray-700">Recent Transactions Sample</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs bg-white rounded">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">ID</th>
                          <th className="text-left p-2">Amount</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">Phone</th>
                          <th className="text-left p-2">Callback?</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debugData.recentTransactions.slice(0, 3).map((tx, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-2 font-mono">{tx.id.substring(0, 8)}...</td>
                            <td className="p-2">{tx.amount}</td>
                            <td className="p-2">
                              <Badge variant={tx.status === 'success' ? 'success' : tx.status === 'pending' ? 'warning' : 'error'}>
                                {tx.status}
                              </Badge>
                            </td>
                            <td className="p-2 font-mono">{tx.phoneNumber}</td>
                            <td className="p-2">{tx.hasCallbackData ? '✅' : '❌'}</td>
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
      </div>
    </div>
  );
};

export default MerchantDashboard;