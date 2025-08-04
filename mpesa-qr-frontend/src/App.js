import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import QRScanner from './components/QRScanner';
import Transactions from './components/Transactions';
import Login from './components/Login';
import Register from './components/Register';

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    // Check if user is already logged in on app load
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        setToken(idToken);
        setUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-blue-600 p-4 shadow-lg">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-white text-2xl font-bold">M-Pesa QR</h1>
            <div className="flex items-center space-x-4">
              {token ? (
                <>
                  <Link to="/" className="text-white hover:text-blue-200">QR Scanner</Link>
                  <Link to="/transactions" className="text-white hover:text-blue-200">Transactions</Link>
                  <span className="text-blue-200">Welcome, {user?.email}</span>
                  <button 
                    onClick={handleLogout}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-white hover:text-blue-200">Login</Link>
                  <Link to="/register" className="text-white hover:text-blue-200">Register</Link>
                </>
              )}
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={
            token ? <QRScanner token={token} user={user} /> : <Login setToken={setToken} setUser={setUser} />
          } />
          <Route path="/transactions" element={
            token ? <Transactions token={token} user={user} /> : <Login setToken={setToken} setUser={setUser} />
          } />
          <Route path="/login" element={<Login setToken={setToken} setUser={setUser} />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;