import React, { useEffect, useRef, useState } from "react";
import "./RoomPage.css";
import { useParams, useNavigate } from "react-router-dom";
import { database, auth } from "../../firebase";
import {
  ref as dbRef,
  onValue,
  set as dbSet,
  push as dbPush,
  remove as dbRemove,
  onDisconnect,
  update,
} from "firebase/database";
import { FileHandler } from "./FileHandler";

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef();
  const chatMessagesRef = useRef();
  const chatbotMessagesRef = useRef();

  const [uploadedDoc, setUploadedDoc] = useState(null);
  const [localFile, setLocalFile] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [notes, setNotes] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // PDF Viewer states
  const [pdfError, setPdfError] = useState(false);
  const [viewerType, setViewerType] = useState("direct");

  // Chatbot states
  const [chatbotInput, setChatbotInput] = useState("");
  const [chatbotResponses, setChatbotResponses] = useState([]);
  const [chatbotLoading, setChatbotLoading] = useState(false);
  const [chatbotConnected, setChatbotConnected] = useState(false);
  const [chatbotStatus, setChatbotStatus] = useState("Initializing...");

  const GEMINI_API_KEY = "AIzaSyAPpVVZmjnTV6HYD5zT4o_XGGoXaP01Sk8";
  const currentUser = auth?.currentUser;
  const displayName = currentUser?.email || `User-${currentUser?.uid?.slice(0, 8) || 'anonymous'}`;

  // Effects
  useEffect(() => {
    checkChatbotConnection();
  }, []);

  useEffect(() => {
    if (chatbotMessagesRef.current) {
      chatbotMessagesRef.current.scrollTop = chatbotMessagesRef.current.scrollHeight;
    }
  }, [chatbotResponses]);

  useEffect(() => {
    setPdfError(false);
  }, [localFile, viewerType]);

  useEffect(() => {
    console.log("RoomPage mounted with roomId:", roomId);
    if (!roomId) {
      console.error("No roomId found!");
      navigate("/");
      return;
    }
  }, [roomId, navigate]);

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [messages]);

  // Presence System
  useEffect(() => {
    if (!roomId || !currentUser) return;

    const uid = currentUser.uid;
    const presRef = dbRef(database, `presence/${roomId}/${uid}`);

    const presenceData = {
      uid,
      name: displayName,
      lastSeen: Date.now(),
    };

    dbSet(presRef, presenceData).catch(console.error);

    const interval = setInterval(() => {
      dbSet(presRef, { ...presenceData, lastSeen: Date.now() }).catch(console.error);
    }, 15000);

    onDisconnect(presRef).remove().catch(console.error);

    return () => {
      clearInterval(interval);
      dbRemove(presRef).catch(console.error);
    };
  }, [roomId, currentUser, displayName]);

  // Listen to participants
  useEffect(() => {
    if (!roomId) return;
    
    const presListRef = dbRef(database, `presence/${roomId}`);
    const unsub = onValue(presListRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.values(val)
        .filter(p => Date.now() - (p.lastSeen || 0) < 60000)
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
        .map((p) => p.name || p.uid);
      setParticipants(arr);
    });
    
    return () => unsub();
  }, [roomId]);

  // Enhanced Room Sync
  useEffect(() => {
    if (!roomId) return;
    
    const roomRef = dbRef(database, `rooms/${roomId}`);
    const unsub = onValue(roomRef, (snap) => {
      const data = snap.val() || {};
      console.log("Room data updated:", data);
      
      if (data.document) {
        console.log("Document found in database:", data.document);
        setUploadedDoc(data.document);
        if (data.document.currentPage) {
          setCurrentPage(data.document.currentPage);
        }
      } else {
        console.log("No document in room");
        setUploadedDoc(null);
        setCurrentPage(1);
      }

      if (data.chat) {
        const arr = Object.values(data.chat)
          .map((m) => ({
            ...m,
            time: m.time || 0,
            sender: m.sender || "Anonymous",
            text: m.text || "",
          }))
          .sort((a, b) => (a.time || 0) - (b.time || 0));
        setMessages(arr);
      } else {
        setMessages([]);
      }
    });

    return () => unsub();
  }, [roomId]);

  // Chatbot Functions
  const checkChatbotConnection = () => {
    if (GEMINI_API_KEY && GEMINI_API_KEY.startsWith('AIzaSy')) {
      setChatbotConnected(true);
      setChatbotStatus("Connected");
    } else {
      setChatbotConnected(false);
      setChatbotStatus("Please set your Gemini API key");
    }
  };

  const handleChatbotQuery = async () => {
    const query = chatbotInput.trim();
    if (!query) return;

    setChatbotLoading(true);
    
    try {
      const userMessage = {
        type: 'user', 
        content: query, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setChatbotResponses(prev => [...prev, userMessage]);
      setChatbotInput("");

      const response = await callGeminiAPI(query, uploadedDoc?.name);
      
      const botMessage = {
        type: 'bot', 
        content: response, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setChatbotResponses(prev => [...prev, botMessage]);
      
    } catch (error) {
      console.error("Chatbot error:", error);
      
      const errorMessage = {
        type: 'bot', 
        content: `Sorry, I'm having trouble right now: ${error.message}`, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setChatbotResponses(prev => [...prev, errorMessage]);
    } finally {
      setChatbotLoading(false);
    }
  };

  const callGeminiAPI = async (userMessage, documentContext = "") => {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    let prompt = `You are EduSync Assistant, an AI designed to help with educational collaboration and document understanding.

Guidelines:
- Provide clear, helpful, and educational explanations
- Focus on learning and understanding concepts
- Be concise but informative (2-3 paragraphs maximum)
- Help users understand educational content and documents
- Support collaborative learning
- Always maintain a helpful, professional, and encouraging tone

`;

    if (documentContext && documentContext !== 'no specific document') {
      prompt += `Current document context: ${documentContext}\n\n`;
    }

    prompt += `User question: ${userMessage}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 500,
      }
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('No response content from AI');
    }
  };

  const onEnterChatbot = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatbotQuery();
    }
  };

  const clearChatbotHistory = () => {
    setChatbotResponses([]);
  };

  const retryChatbotConnection = () => {
    checkChatbotConnection();
  };

  // ==================== SIMPLIFIED FILE HANDLING ====================

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    
    if (!file) return;

    console.log("📁 File selected for preview:", file.name, file.size, "bytes");

    // Validate file before proceeding
    if (file.size === 0) {
      alert("Error: The selected file appears to be empty (0 bytes). Please select a valid file.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert("Error: File size too large! Please select a file smaller than 15MB.");
      return;
    }

    // Create local preview immediately
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    
    // Create local file object for immediate preview
    const localFileObject = {
      url: URL.createObjectURL(file), // Local blob URL for immediate viewing
      name: file.name,
      type: file.type,
      uploadedBy: displayName,
      uploadedAt: Date.now(),
      currentPage: 1,
      fileType: fileExtension.toUpperCase(),
      fileSize: fileSize,
      isLocal: true,
      localFile: file,
      bytes: file.size
    };

    setLocalFile(localFileObject);
    setPdfError(false);
    
    // Upload to cloud in background (but don't use cloud URL for viewing)
    await uploadToCloud(file, localFileObject);
  };

  const uploadToCloud = async (file, localFileObject) => {
    setUploading(true);

    try {
      console.log("🚀 Starting cloud upload (for backup only)...");
      
      // Upload to cloud but we won't use the cloud URL for viewing
      const cloudDoc = await FileHandler.handleFileUpload(file, roomId, displayName, database);
      console.log("✅ File uploaded to cloud successfully (for backup)");
      
      // Update the database with document info but keep using local file for viewing
      const updatedLocalFile = {
        ...localFileObject,
        cloudUrl: cloudDoc.url, // Store cloud URL but don't use it for viewing
        cloudPublicId: cloudDoc.cloudinaryPublicId
      };
      
      setLocalFile(updatedLocalFile);
      
    } catch (error) {
      console.error("❌ Cloud upload error:", error);
      // Even if cloud upload fails, keep the local preview
      console.log("⚠️ Cloud upload failed, but local preview remains available");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Real-time Page Navigation Sync
  const handlePageChange = async (newPage) => {
    if (!roomId || !localFile || newPage < 1) return;
    
    try {
      // Update local file state
      setLocalFile(prev => ({ ...prev, currentPage: newPage }));
      setCurrentPage(newPage);
      
      // Also update in database for other users
      if (localFile.cloudUrl) {
        await update(dbRef(database, `rooms/${roomId}/document`), {
          currentPage: newPage
        });
      }
    } catch (err) {
      console.error("Failed to change page:", err);
    }
  };

  // ==================== LOCAL FILE VIEWER FUNCTIONS ====================

  const getPDFViewerURL = () => {
    if (!localFile?.url) return "";
    
    // Always use the local blob URL for viewing
    return localFile.url;
  };

  const handlePDFError = () => {
    console.error("PDF failed to load from local file");
    setPdfError(true);
  };

  const switchViewer = (newViewerType) => {
    // For local files, only direct viewer works
    if (newViewerType === "google" || newViewerType === "office") {
      alert("Google and Office viewers only work with cloud-uploaded files. Using direct viewer instead.");
      setViewerType("direct");
    } else {
      setViewerType(newViewerType);
    }
    setPdfError(false);
  };

  const handleDownload = () => {
    if (!localFile) return;

    try {
      // Download the local file directly
      const link = document.createElement('a');
      link.href = localFile.url;
      link.download = localFile.name;
      link.target = '_blank';
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log("✅ Local file download initiated");
      
    } catch (error) {
      console.error("Download error:", error);
      alert(`Download failed: ${error.message}`);
    }
  };

  const renderPDFViewer = () => {
    if (!localFile) return null;

    return (
      <div className="pdf-viewer-container">
        <div className="viewer-controls">
          <div className="viewer-options">
            <span>Viewer: </span>
            <button 
              className={`btn small active`}
              onClick={() => switchViewer('direct')}
            >
              Direct (Local)
            </button>
            <button 
              className={`btn small disabled`}
              onClick={() => switchViewer('google')}
              disabled={true}
              title="Available only for cloud files"
            >
              Google
            </button>
            <button 
              className={`btn small disabled`}
              onClick={() => switchViewer('office')}
              disabled={true}
              title="Available only for cloud files"
            >
              Office
            </button>
          </div>
          <div className="download-options">
            <span className="file-status">
              {uploading ? "🔄 Uploading to cloud..." : "📱 Viewing from device"}
            </span>
            <button 
              className="btn secondary small"
              onClick={() => window.open(localFile.url, '_blank')}
            >
              Open in New Tab
            </button>
            <button 
              className="btn secondary small"
              onClick={handleDownload}
            >
              Download
            </button>
          </div>
        </div>

        {pdfError ? (
          <div className="pdf-error-fallback">
            <div className="error-content">
              <h3>Unable to display PDF preview</h3>
              <p>There was an issue loading the PDF document from your device.</p>
              <div className="error-actions">
                <button 
                  className="btn primary"
                  onClick={() => window.open(localFile.url, '_blank')}
                >
                  Open PDF in New Tab
                </button>
                <button 
                  className="btn secondary"
                  onClick={handleDownload}
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="pdf-embed-container">
            <iframe
              key={`pdf-local-${localFile.url}`}
              src={getPDFViewerURL()}
              title={`PDF Document - ${localFile.name}`}
              className="pdf-embed"
              onError={handlePDFError}
              onLoad={() => {
                console.log("PDF loaded successfully from local file");
                setPdfError(false);
              }}
            />
          </div>
        )}

        <div className="page-navigation">
          <button
            className="btn page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            ← Previous Page
          </button>
          <span className="page-info">Page {currentPage}</span>
          <button
            className="btn page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next Page →
          </button>
        </div>
      </div>
    );
  };

  const renderOfficeViewer = () => {
    if (!localFile?.url) return null;

    return (
      <div className="office-viewer-container">
        <div className="viewer-controls">
          <div className="download-options">
            <span className="file-status">
              {uploading ? "🔄 Uploading to cloud..." : "📱 Viewing from device"}
            </span>
            <button 
              className="btn secondary small"
              onClick={() => window.open(localFile.url, '_blank')}
            >
              Open in New Tab
            </button>
            <button 
              className="btn secondary small"
              onClick={handleDownload}
            >
              Download
            </button>
          </div>
        </div>
        <iframe
          src={localFile.url}
          title={`Office Document - ${localFile.name}`}
          className="office-embed"
          onError={(e) => console.error("Office document failed to load from local file:", e)}
        />
      </div>
    );
  };

  const renderImageViewer = () => {
    if (!localFile?.url) return null;

    return (
      <div className="image-viewer-container">
        <div className="viewer-controls">
          <div className="download-options">
            <span className="file-status">
              {uploading ? "🔄 Uploading to cloud..." : "📱 Viewing from device"}
            </span>
            <button 
              className="btn secondary small"
              onClick={() => window.open(localFile.url, '_blank')}
            >
              Open in New Tab
            </button>
            <button 
              className="btn secondary small"
              onClick={handleDownload}
            >
              Download
            </button>
          </div>
        </div>
        <div className="image-container">
          <img 
            src={localFile.url} 
            alt={localFile.name}
            className="document-image"
            onError={(e) => console.error("Image failed to load from local file:", e)}
          />
        </div>
      </div>
    );
  };

  const renderDocumentViewer = () => {
    if (!localFile) return null;

    const fileExtension = localFile.name.split(".").pop().toLowerCase();

    if (fileExtension === "pdf") {
      return renderPDFViewer();
    } else if (["ppt", "pptx", "doc", "docx", "xlsx"].includes(fileExtension)) {
      return renderOfficeViewer();
    } else if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension)) {
      return renderImageViewer();
    } else {
      return (
        <div className="unsupported-viewer">
          <div className="unsupported-content">
            <h3>Preview not available for {fileExtension.toUpperCase()} files</h3>
            <p>File: <strong>{localFile.name}</strong></p>
            <div className="file-actions">
              <button 
                className="btn primary"
                onClick={() => window.open(localFile.url, '_blank')}
              >
                Open in New Tab
              </button>
              <button 
                className="btn secondary"
                onClick={handleDownload}
              >
                Download File
              </button>
            </div>
          </div>
        </div>
      );
    }
  };

  const getCurrentDocument = () => {
    return localFile;
  };

  // Chat Functions
  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !roomId) return;
    
    try {
      const msgRef = dbPush(dbRef(database, `rooms/${roomId}/chat`));
      await dbSet(msgRef, { 
        text, 
        sender: displayName, 
        time: Date.now() 
      });
      setChatInput("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const onEnterSend = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Leave Room
  const handleLeaveRoom = () => {
    if (currentUser?.uid) {
      dbRemove(dbRef(database, `presence/${roomId}/${currentUser.uid}`)).catch(console.error);
    }
    navigate("/");
  };

  // Render
  if (!roomId) {
    return <div>Loading room...</div>;
  }

  const currentDoc = getCurrentDocument();

  return (
    <div className="room-root">
      <header className="room-top">
        <div className="left">
          <h1 className="brand">EduSync</h1>
          <div className="subtitle">
            Room: {roomId} • {currentDoc ? `Viewing: ${currentDoc.name}` : 'No document'}
            {currentDoc && " (From Your Device)"}
          </div>
        </div>
        <div className="right">
          <div className="upload-container">
            <button 
              className="btn primary" 
              onClick={triggerFileSelect} 
              disabled={uploading}
            >
              {uploading ? "Uploading to Cloud..." : "Upload Document"}
            </button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.ppt,.pptx,.docx,.xlsx,.doc,.jpg,.jpeg,.png,.gif,.webp"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />
          <button className="btn ghost" onClick={handleLeaveRoom}>
            Leave Room
          </button>
        </div>
      </header>

      <div className="room-layout">
        {/* Left Side: Participants + Chatbot */}
        <aside className="left-panel">
          <div className="panel half">
            <h3>👥 Participants ({participants.length})</h3>
            <div className="participants-list">
              {participants.length === 0 ? (
                <div className="empty">No participants yet</div>
              ) : (
                participants.map((p, i) => (
                  <div key={i} className="participant-row">
                    <div className="avatar">{p[0]?.toUpperCase() || 'U'}</div>
                    <span>{p}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel half chatbot-container">
            <div className="chatbot-header">
              <h3>🤖 EduSync Assistant</h3>
              <div className="chatbot-controls">
                <div className={`chatbot-status ${chatbotConnected ? 'connected' : 'disconnected'}`}>
                  {chatbotConnected ? '🟢' : '🔴'} {chatbotStatus}
                </div>
                {!chatbotConnected && (
                  <button className="btn retry-btn" onClick={retryChatbotConnection} title="Retry connection">
                    🔄
                  </button>
                )}
                {chatbotResponses.length > 0 && (
                  <button className="btn clear-btn" onClick={clearChatbotHistory} title="Clear chat">
                    🗑️
                  </button>
                )}
              </div>
            </div>
            
            <div 
              ref={chatbotMessagesRef}
              className="chatbot-messages"
            >
              {chatbotResponses.length === 0 ? (
                <div className="empty">
                  {chatbotConnected ? (
                    <>
                      <p>Ask me about your document or learning topics!</p>
                      <div className="chatbot-examples">
                        <small>Try: "Explain this PDF" or "What is machine learning?"</small>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Please configure your Gemini API key</p>
                      <div className="chatbot-examples">
                        <small>Replace GEMINI_API_KEY in the code with your actual key</small>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                chatbotResponses.map((msg, i) => (
                  <div key={i} className={`chatbot-message ${msg.type}`}>
                    <div className="chatbot-message-header">
                      <strong>{msg.type === 'user' ? 'You' : 'EduSync Assistant'}</strong>
                      <span className="chatbot-time">{msg.time}</span>
                    </div>
                    <div className="chatbot-message-text">{msg.content}</div>
                  </div>
                ))
              )}
              {chatbotLoading && (
                <div className="chatbot-message bot">
                  <div className="chatbot-typing">
                    <span className="typing-dots">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                    EduSync Assistant is thinking...
                  </div>
                </div>
              )}
            </div>
            
            <div className="chatbot-input">
              <input
                type="text"
                value={chatbotInput}
                onChange={(e) => setChatbotInput(e.target.value)}
                onKeyDown={onEnterChatbot}
                placeholder={chatbotConnected ? "Ask about your document..." : "Configure API key first"}
                disabled={chatbotLoading || !chatbotConnected}
              />
              <button 
                className="btn primary" 
                onClick={handleChatbotQuery}
                disabled={chatbotLoading || !chatbotInput.trim() || !chatbotConnected}
              >
                {chatbotLoading ? "..." : "Ask"}
              </button>
            </div>
          </div>
        </aside>

        {/* Center: Enhanced Document Viewer */}
        <main className="center-panel">
          {currentDoc ? (
            <>
              <div className="doc-header">
                <div className="doc-title">
                  {currentDoc.name} 
                  <span className="file-type-badge">{currentDoc.fileType}</span>
                  {currentDoc.fileSize && (
                    <span className="file-size-badge">{currentDoc.fileSize}</span>
                  )}
                  <span className="local-badge">From Your Device</span>
                </div>
                <div className="doc-sub">
                  Previewing from your device • {uploading ? "Uploading backup to cloud..." : "Backup uploaded to cloud"}
                </div>
              </div>
              {renderDocumentViewer()}
            </>
          ) : (
            <div className="viewer-empty">
              <p>No document uploaded yet.</p>
              <p className="upload-hint">Upload a file to start collaborating</p>
              <p className="upload-tip">
                💡 <strong>Supported files:</strong> PDF, PPT, PPTX, DOCX, XLSX, DOC, JPG, JPEG, PNG, GIF, WEBP (max 15MB)
              </p>
              <button className="btn primary" onClick={triggerFileSelect}>
                Upload Document
              </button>
            </div>
          )}
        </main>

        {/* Right Side: Notes + Chat */}
        <aside className="right-panel">
          <div className="panel half">
            <h3>📝 Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Type your private notes..."
              rows={5}
            />
          </div>

          <div className="panel half chat-container">
            <h3>💬 Group Chat</h3>
            <div 
              ref={chatMessagesRef}
              className="chat-messages"
            >
              {messages.length === 0 ? (
                <div className="empty">No messages yet. Start the conversation!</div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className="message">
                    <div className="message-header">
                      <strong>{m.sender}</strong>
                      <span className="message-time">
                        {new Date(m.time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="message-text">{m.text}</div>
                  </div>
                ))
              )}
            </div>
            <div className="chat-input">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={onEnterSend}
                placeholder="Type a message..."
              />
              <button className="btn primary" onClick={handleSendMessage}>
                Send
              </button>
            </div>
          </div>
        </aside>
      </div>

      <footer className="room-footer">
        EduSync — Real-time collaboration • Room: {roomId} • User: {displayName}
        {currentDoc && ` • Viewing: ${currentDoc.name} (From Your Device)`}
        {uploading && ` • 🔄 Uploading backup to cloud`}
        {chatbotConnected && ` • 🤖 Google Gemini 2.0 Flash: Online`}
      </footer>
    </div>
  );
}