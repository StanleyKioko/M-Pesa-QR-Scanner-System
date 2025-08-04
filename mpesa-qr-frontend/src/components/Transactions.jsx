import { useState, useEffect } from 'react';
import axios from 'axios';

function Transactions({ token }) {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchTransactions = async () => {
      try {
        const response = await axios.get('http://localhost:3000/transactions', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        setTransactions(response.data.transactions || []);
      } catch (err) {
        console.error('Fetch transactions error:', err);
        setError(err.response?.data?.error || 'Failed to fetch transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [token]);

  if (!token) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-center text-red-600">Please login to view transactions</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Transaction History</h2>
      
      {error && <p className="text-red-600 mb-4">{error}</p>}
      
      {transactions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No transactions found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left font-medium text-gray-900">Transaction ID</th>
                <th className="p-3 text-left font-medium text-gray-900">Phone Number</th>
                <th className="p-3 text-left font-medium text-gray-900">Amount (KSH)</th>
                <th className="p-3 text-left font-medium text-gray-900">Status</th>
                <th className="p-3 text-left font-medium text-gray-900">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50">
                  <td className="p-3 text-sm text-gray-900">{txn.transactionRef || txn.id}</td>
                  <td className="p-3 text-sm text-gray-900">{txn.phoneNumber}</td>
                  <td className="p-3 text-sm text-gray-900">{txn.amount}</td>
                  <td className="p-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      txn.status === 'success' ? 'bg-green-100 text-green-800' :
                      txn.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {txn.status}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-gray-900">
                    {txn.updatedAt ? new Date(txn.updatedAt.seconds * 1000).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Transactions;