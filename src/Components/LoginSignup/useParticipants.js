// src/Components/LoginSignup/useParticipants.js
import { useState, useEffect } from "react";
import { database } from "../../firebase";
import { ref, onValue } from "firebase/database";

/**
 * useParticipants hook - Uses presence system instead of participants list
 * @param {string} roomId - current room ID
 * @returns {object} { participants }
 */
const useParticipants = (roomId) => {
  const [participants, setParticipants] = useState([]);

  // Sync participants list from presence system
  useEffect(() => {
    if (!roomId) {
      setParticipants([]);
      return;
    }

    const presenceRef = ref(database, `presence/${roomId}`);
    
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      const activeParticipants = Object.values(data)
        .filter(p => Date.now() - (p.lastSeen || 0) < 60000) // Active in last minute
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
        .map(p => p.name || p.uid);
      
      setParticipants(activeParticipants);
    });

    return () => unsubscribe();
  }, [roomId]);

  return { participants };
};

export default useParticipants;