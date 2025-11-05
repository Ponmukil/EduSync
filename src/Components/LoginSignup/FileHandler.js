import { ref as dbRef, set as dbSet } from "firebase/database";

export class FileHandler {
  static async handleFileUpload(file, roomId, displayName, database) {
    console.log("📁 File selected:", file);
    console.log("📊 File size:", file.size, "bytes");
    
    if (!file) {
      throw new Error("No file selected");
    }
    
    if (!roomId) {
      throw new Error("No room ID available");
    }

    // File validation
    const allowedTypes = ['.pdf', '.ppt', '.pptx', '.docx', '.xlsx', '.doc', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
      throw new Error('Please upload PDF, PPT, PPTX, DOCX, XLSX, DOC, or image files only');
    }

    // File size check (15MB limit)
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File size too large! Please upload files smaller than 15MB.');
    }

    // Check if file is actually readable
    if (file.size === 0) {
      throw new Error('File appears to be empty (0 bytes). Please select a valid file.');
    }

    console.log("Starting Cloudinary upload...");

    try {
      // Cloudinary upload with proper error handling
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'edusync_upload'); // Make sure this preset exists
      formData.append('folder', `rooms/${roomId}`);
      
      // Add timestamp to avoid caching issues
      formData.append('timestamp', Date.now().toString());

      console.log("📤 Sending to Cloudinary...");
      console.log("📦 FormData entries:", Array.from(formData.entries()));
      
      const cloudinaryResponse = await fetch('https://api.cloudinary.com/v1_1/dht72yiy8/upload', {
        method: 'POST',
        body: formData
      });

      console.log("📥 Cloudinary response status:", cloudinaryResponse.status);
      
      if (!cloudinaryResponse.ok) {
        const errorText = await cloudinaryResponse.text();
        console.error("❌ Cloudinary error response:", errorText);
        
        // Try to parse JSON error if possible
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(`Cloudinary upload failed: ${errorJson.error?.message || errorText}`);
        } catch {
          throw new Error(`Cloudinary upload failed: ${cloudinaryResponse.status} - ${errorText}`);
        }
      }

      const cloudinaryData = await cloudinaryResponse.json();
      console.log("✅ Cloudinary upload successful:", cloudinaryData);

      // Verify the upload was successful
      if (!cloudinaryData.secure_url) {
        throw new Error('Cloudinary upload failed: No URL returned');
      }

      if (cloudinaryData.bytes !== file.size) {
        console.warn(`⚠️ File size mismatch: uploaded ${cloudinaryData.bytes} bytes, original ${file.size} bytes`);
      }

      const url = cloudinaryData.secure_url;
      console.log("🌐 File URL:", url);
      console.log("💾 Uploaded file size:", cloudinaryData.bytes, "bytes");

      const newDoc = {
        url,
        name: file.name,
        type: file.type,
        uploadedBy: displayName,
        uploadedAt: Date.now(),
        currentPage: 1,
        fileType: fileExt.replace('.', '').toUpperCase(),
        fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        cloudinaryPublicId: cloudinaryData.public_id,
        resourceType: cloudinaryData.resource_type,
        bytes: cloudinaryData.bytes, // Store actual uploaded bytes
        format: cloudinaryData.format // Store file format
      };

      console.log("💾 Saving document to database:", newDoc);
      
      // Update document in database
      await dbSet(dbRef(database, `rooms/${roomId}/document`), newDoc);
      
      console.log(`✅ Document uploaded successfully by ${displayName}: ${file.name}`);
      return newDoc;
      
    } catch (error) {
      console.error("❌ Upload failed:", error);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  static async downloadFile(url, filename) {
    try {
      console.log("📥 Downloading file from:", url);
      
      // Test if the URL is accessible
      const testResponse = await fetch(url, { method: 'HEAD' });
      if (!testResponse.ok) {
        throw new Error(`File not accessible: ${testResponse.status}`);
      }
      
      const contentLength = testResponse.headers.get('content-length');
      console.log("📊 File size from server:", contentLength, "bytes");
      
      if (contentLength === '0') {
        throw new Error('File appears to be empty on server');
      }

      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log("✅ Download initiated successfully");
      
    } catch (error) {
      console.error('❌ Download failed:', error);
      
      // Fallback: open in new tab
      console.log("🔄 Trying fallback: open in new tab");
      window.open(url, '_blank');
    }
  }

  // Helper function to verify file upload
  static async verifyUpload(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.error('Verification failed:', error);
      return false;
    }
  }
}