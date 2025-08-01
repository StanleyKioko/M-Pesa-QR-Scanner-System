import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';
import QRScanner from './components/QRScanner';
import Transactions from './components/Transactions';
import Login from './components/Login';

function App() {
  const [token, setToken] = useState(null);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-blue-600 p-4">
          <div className="container mx-auto flex justify-between">
            <h1 className="text-white text-2xl font-bold">M-Pesa QR</h1>
            <div>
              <Link to="/" className="text-white mx-4 text-center">QR Scanner</Link>
              <Link to="/transactions" className="text-white mx-4">Transactions</Link>
              {!token && <Link to="/login" className="text-white mx-4">Login</Link>}
              {token && <button onClick={() => setToken(null)} className="text-white mx-4">Logout</button>}
            </div>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<QRScanner token={token} />} />
          <Route path="/transactions" element={<Transactions token={token} />} />
          <Route path="/login" element={<Login setToken={setToken} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;