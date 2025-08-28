import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import axios from 'axios';
import { API_BASE_URL } from '../utility/constants';

// Create the auth context
const AuthContext = createContext();

// Hook to use auth context
export function useAuth() {
  return useContext(AuthContext);
}

// Provider component that wraps app and provides auth context
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [merchantData, setMerchantData] = useState(null);

  // Set up auth state listener on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // If user is logged in, fetch their merchant data
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          const response = await axios.post(
            `${API_BASE_URL}/api/auth/verify-token`,
            { idToken },
            {
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (response.data && response.data.user) {
            setMerchantData(response.data.user);
          }
        } catch (error) {
          console.error('Error fetching merchant data:', error);
        }
      } else {
        // Clear merchant data when user logs out
        setMerchantData(null);
      }
      
      setLoading(false);
    });

    // Clean up subscription on unmount
    return () => unsubscribe();
  }, []);

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      setMerchantData(null);
      // You might want to redirect to login page after logout
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Context value to be provided to consumers
  const value = {
    user,
    loading,
    merchantData,
    setMerchantData,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}