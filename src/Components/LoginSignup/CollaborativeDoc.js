import React, { useState, useEffect } from "react";
import { database } from "../../firebase";
import { ref, onValue, update } from "firebase/database";
import "./CollaborativeDoc.css";

const CollaborativeDoc = ({ roomId }) => {
  const [document, setDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfError, setPdfError] = useState(false);
  const [officeError, setOfficeError] = useState(false);

  // Listen for document changes
  useEffect(() => {
    if (!roomId) return;

    const docRef = ref(database, `rooms/${roomId}/document`);
    const unsubscribe = onValue(docRef, (snapshot) => {
      const data = snapshot.val();
      setDocument(data);
      setPdfError(false);
      setOfficeError(false);
      if (data?.currentPage) {
        setCurrentPage(data.currentPage);
      }
    });

    return () => unsubscribe();
  }, [roomId]);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (!roomId || !document || newPage < 1) return;
    
    setCurrentPage(newPage);
    update(ref(database, `rooms/${roomId}/document`), { 
      currentPage: newPage 
    }).catch(console.error);
  };

  // Get the appropriate viewer URL based on file type
  const getViewerURL = () => {
    if (!document?.url) return "";
    const ext = document.name.split(".").pop().toLowerCase();
    
    // For PDFs - use direct URL with viewer parameters
    if (ext === "pdf") {
      return `${document.url}#toolbar=1&navpanes=1&scrollbar=1`;
    }
    
    // For Office files - use Microsoft Office Online Viewer
    if (["ppt", "pptx", "doc", "docx", "xlsx"].includes(ext)) {
      return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
        document.url
      )}`;
    }
    
    // For images
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      return document.url;
    }
    
    return document.url;
  };

  // Handle iframe loading errors
  const handleIframeError = (fileType) => {
    console.error(`Failed to load ${fileType}`);
    if (fileType === 'pdf') {
      setPdfError(true);
    } else {
      setOfficeError(true);
    }
  };

  // Force iframe reload when document changes
  const iframeKey = document?.url ? `doc-${document.url}-${Date.now()}` : 'doc-iframe';

  if (!document) {
    return (
      <div className="document-box">
        <div className="upload-message">
          <p>No document uploaded yet</p>
          <small>Upload a file to start collaborating</small>
        </div>
      </div>
    );
  }

  const fileExtension = document.name.split(".").pop().toLowerCase();

  return (
    <div className="document-box">
      <div className="doc-header">
        <div className="doc-title">
          {document.name}
          <span className="file-badge">{fileExtension.toUpperCase()}</span>
        </div>
        <div className="doc-sub">
          Uploaded by {document.uploadedBy} • {fileExtension.toUpperCase()} file
          {document.fileSize && ` • ${document.fileSize}`}
        </div>
      </div>
      
      {/* PDF Viewer */}
      {fileExtension === "pdf" ? (
        pdfError ? (
          <div className="error-fallback">
            <h3>Unable to display PDF preview</h3>
            <p>The PDF file cannot be displayed in the browser.</p>
            <div className="error-actions">
              <a 
                href={document.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn primary"
              >
                Open PDF in New Tab
              </a>
              <a 
                href={document.url} 
                download={document.name}
                className="btn secondary"
              >
                Download PDF
              </a>
            </div>
          </div>
        ) : (
          <>
            <iframe
              key={iframeKey}
              src={getViewerURL()}
              title="PDF Document"
              className="document-iframe"
              onError={() => handleIframeError('pdf')}
            />
            <div className="page-controls">
              <button
                className="btn page-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                ← Previous
              </button>
              <span className="page-info">Page {currentPage}</span>
              <button
                className="btn page-btn"
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next →
              </button>
            </div>
          </>
        )
      ) : 
      
      {/* Office Files Viewer */}
      ["ppt", "pptx", "doc", "docx", "xlsx"].includes(fileExtension) ? (
        officeError ? (
          <div className="error-fallback">
            <h3>Unable to display document preview</h3>
            <p>The document cannot be displayed in the browser.</p>
            <div className="error-actions">
              <a 
                href={document.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn primary"
              >
                Open in New Tab
              </a>
              <a 
                href={document.url} 
                download={document.name}
                className="btn secondary"
              >
                Download File
              </a>
            </div>
          </div>
        ) : (
          <iframe
            key={iframeKey}
            src={getViewerURL()}
            title="Office Document"
            className="document-iframe"
            onError={() => handleIframeError('office')}
          />
        )
      ) : 
      
      {/* Image Files */}
      ["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension) ? (
        <div className="image-viewer">
          <img 
            src={document.url} 
            alt={document.name}
            className="document-image"
            onError={() => handleIframeError('image')}
          />
        </div>
      ) : 
      
      {/* Unsupported file type */}
      (
        <div className="unsupported-file">
          <h3>Preview not available for {fileExtension.toUpperCase()} files</h3>
          <p>File: <strong>{document.name}</strong></p>
          <div className="error-actions">
            <a 
              href={document.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn primary"
            >
              Open in New Tab
            </a>
            <a 
              href={document.url} 
              download={document.name}
              className="btn secondary"
            >
              Download File
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborativeDoc;