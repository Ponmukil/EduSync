import React, { useState, useEffect } from "react";
import "./HomePage.css";
import { FaUserCircle } from "react-icons/fa";
import { auth, database } from "../../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ref, set, get } from "firebase/database";

const HomePage = () => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinRoomPassword, setJoinRoomPassword] = useState("");
  const [showCreateFields, setShowCreateFields] = useState(false);
  const [showJoinFields, setShowJoinFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.body.className = darkMode ? "dark-mode" : "light-mode";
  }, [darkMode]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showUserMenu) setShowUserMenu(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showUserMenu]);

  const toggleUserMenu = (e) => {
    e.stopPropagation();
    setShowUserMenu(!showUserMenu);
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    setShowUserMenu(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      setError("Failed to sign out");
    }
  };

  const validateRoomId = (id) => {
    return /^[a-zA-Z0-9_-]+$/.test(id); // Alphanumeric, hyphens, underscores
  };

  const handleCreateRoom = async () => {
    setError("");
    
    if (!roomId.trim() || !roomPassword.trim()) {
      setError("Room ID and password are required!");
      return;
    }

    if (!validateRoomId(roomId)) {
      setError("Room ID can only contain letters, numbers, hyphens, and underscores");
      return;
    }

    if (roomPassword.length < 4) {
      setError("Password must be at least 4 characters long");
      return;
    }

    setLoading(true);

    try {
      const roomRef = ref(database, `rooms/${roomId}`);
      const snapshot = await get(roomRef);
      
      if (snapshot.exists()) {
        setError("Room ID already exists. Please choose a different one.");
        return;
      }

      await set(roomRef, { 
        password: roomPassword, 
        document: null, 
        participants: [],
        createdAt: Date.now(),
        createdBy: auth.currentUser?.email || "unknown"
      });
      
      navigate(`/room/${roomId}`);
    } catch (error) {
      console.error("Error creating room:", error);
      setError("Failed to create room. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    setError("");
    
    if (!joinRoomId.trim() || !joinRoomPassword.trim()) {
      setError("Please enter both Room ID and Password");
      return;
    }

    setLoading(true);

    try {
      const roomRef = ref(database, `rooms/${joinRoomId}`);
      const snapshot = await get(roomRef);
      
      if (!snapshot.exists()) {
        setError("Room does not exist");
        return;
      }

      const roomData = snapshot.val();
      if (roomData.password !== joinRoomPassword) {
        setError("Incorrect password");
        return;
      }

      navigate(`/room/${joinRoomId}`);
    } catch (error) {
      console.error("Error joining room:", error);
      setError("Failed to join room. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForms = () => {
    setRoomId("");
    setRoomPassword("");
    setJoinRoomId("");
    setJoinRoomPassword("");
    setError("");
  };

  const showCreate = () => {
    setShowCreateFields(true);
    setShowJoinFields(false);
    resetForms();
  };

  const showJoin = () => {
    setShowJoinFields(true);
    setShowCreateFields(false);
    resetForms();
  };

  return (
    <div className="home-container">
      <header className="header">
        <div className="title">EduSync – Collaborative Learning Platform</div>
        <div className="user-section">
          <FaUserCircle 
            className="user-icon" 
            size={32} 
            onClick={toggleUserMenu} 
          />
          {showUserMenu && (
            <div className="user-menu" onClick={(e) => e.stopPropagation()}>
              <div className="menu-item" onClick={toggleTheme}>
                {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
              </div>
              <div className="menu-item" onClick={handleSignOut}>
                🚪 Sign Out
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <div className="welcome-text">
          <h1>Welcome to EduSync</h1>
          <p>Connect. Collaborate. Learn together in real time.</p>
        </div>

        <div className="action-card">
          {error && <div className="error-banner">{error}</div>}
          
          <div className="button-row">
            <button
              className={`main-btn ${showCreateFields ? "active" : ""}`}
              onClick={showCreate}
              disabled={loading}
            >
              Create Room
            </button>
            <button
              className={`main-btn ${showJoinFields ? "active" : ""}`}
              onClick={showJoin}
              disabled={loading}
            >
              Join Room
            </button>
          </div>

          {showCreateFields && (
            <div className="input-fields fade-in">
              <input
                placeholder="Enter Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={loading}
              />
              <input
                placeholder="Set Password"
                type="password"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                disabled={loading}
              />
              <button 
                onClick={handleCreateRoom} 
                className="sub-btn"
                disabled={loading}
              >
                {loading ? "Creating..." : "🚀 Create"}
              </button>
            </div>
          )}

          {showJoinFields && (
            <div className="input-fields fade-in">
              <input
                placeholder="Enter Room ID"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                disabled={loading}
              />
              <input
                placeholder="Enter Password"
                type="password"
                value={joinRoomPassword}
                onChange={(e) => setJoinRoomPassword(e.target.value)}
                disabled={loading}
              />
              <button 
                onClick={handleJoinRoom} 
                className="sub-btn"
                disabled={loading}
              >
                {loading ? "Joining..." : "🔗 Join"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;