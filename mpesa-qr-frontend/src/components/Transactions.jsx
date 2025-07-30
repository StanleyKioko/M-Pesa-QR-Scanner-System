import { useState, useEffect } from 'react';
import axios from 'axios';

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.get('http://localhost:3000/transactions?status=paid', {
          headers: {
            'Authorization': 'Bearer <new_id_token>'
          },
        });
        setTransactions(response.data.transactions);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch transactions');
      }
    };
    fetchTransactions();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Transactions</h2>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {transactions.length === 0 ? (
        <p>No paid transactions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr>
                <th className="p-2 border">Transaction Ref</th>
                <th className="p-2 border">Phone Number</th>
                <th className="p-2 border">Amount</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="p-2 border">{txn.transactionRef}</td>
                  <td className="p-2 border">{txn.phoneNumber}</td>
                  <td className="p-2 border">{txn.amount}</td>
                  <td className="p-2 border">{txn.status}</td>
                  <td className="p-2 border">{new Date(txn.updatedAt).toLocaleString()}</td>
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