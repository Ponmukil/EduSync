import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';

import LoginSignup from './Components/LoginSignup/LoginSignup';
import HomePage from './Components/LoginSignup/HomePage';
import RoomPage from './Components/LoginSignup/RoomPage';
import Signup from './Components/LoginSignup/Signup';

import { auth } from './firebase';

// --- PrivateRoute ---
const PrivateRoute = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div>Loading...</div>;

  return currentUser ? children : <Navigate to="/login" />;
};

// --- PublicRoute: Prevent logged-in user from visiting login/signup ---
const PublicRoute = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div>Loading...</div>;

  return currentUser ? <Navigate to="/" /> : children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Launch/Login Page */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginSignup />
            </PublicRoute>
          }
        />
        {/* Signup Page */}
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          }
        />
        {/* Home Page (after login) */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <HomePage />
            </PrivateRoute>
          }
        />
        {/* Room Page (inside private route) */}
        <Route
          path="/room/:roomId"
          element={
            <PrivateRoute>
              <RoomPage />
            </PrivateRoute>
          }
        />
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
