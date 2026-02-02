/**
 * Room Management Module
 * 
 * Handles room creation, joining, and participant management
 */

import { db } from './firebase.js';
import { 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Generate unique room code (6 characters)
 * @returns {string} - Random room code
 */
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a new room
 * @param {Object} config - Room configuration
 * @param {string} config.roomName - Name of the room
 * @param {Object} config.rounds - Round configurations
 * @param {string} config.userId - Admin user ID
 * @returns {Promise<Object>} - Created room object
 */
export async function createRoom(config) {
  try {
    // Validate inputs
    if (!config || !config.roomName || !config.userId) {
      return {
        success: false,
        error: 'Invalid room configuration'
      };
    }
    
    if (!config.rounds || !config.rounds.r1) {
      return {
        success: false,
        error: 'Round configuration must be provided'
      };
    }
    
    // Validate round configuration
    const roundData = config.rounds.r1;
    if (!roundData.paragraph || !roundData.time || !roundData.qualifyCount) {
      return {
        success: false,
        error: 'Round configuration is incomplete'
      };
    }
    if (roundData.time <= 0 || roundData.time > 3600) {
      return {
        success: false,
        error: 'Round time must be between 1 and 3600 seconds'
      };
    }
    if (roundData.qualifyCount < 1) {
      return {
        success: false,
        error: 'Winner count must be at least 1'
      };
    }
    
    // Generate unique room code (retry if duplicate)
    let roomCode = generateRoomCode();
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const roomsRef = collection(db, 'rooms');
      const q = query(roomsRef, where('roomCode', '==', roomCode));
      const existingRooms = await getDocs(q);
      
      if (existingRooms.empty) {
        break; // Room code is unique
      }
      
      roomCode = generateRoomCode();
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return {
        success: false,
        error: 'Failed to generate unique room code. Please try again.'
      };
    }
    
    // Create room document
    const roomsRef = collection(db, 'rooms');
    const roomRef = await addDoc(roomsRef, {
      roomCode: roomCode,
      roomName: config.roomName.trim(),
      currentRound: 0,
      status: 'waiting', // NEW: Main status field for state machine
      roundStatus: 'waiting', // Keep for backward compatibility
      createdBy: config.userId,
      createdAt: serverTimestamp()
    });
    
    const roomId = roomRef.id;
    
    // Create room configuration
    const configRef = doc(db, 'roomConfig', roomId);
    await setDoc(configRef, {
      rounds: {
        r1: {
          paragraph: config.rounds.r1.paragraph.trim(),
          time: parseInt(config.rounds.r1.time),
          qualifyCount: parseInt(config.rounds.r1.qualifyCount)
        }
      }
    });
    
    return {
      success: true,
      roomId: roomId,
      roomCode: roomCode
    };
  } catch (error) {
    console.error('Create room error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Join a room by room code
 * @param {string} roomCode - Room code to join
 * @param {string} userId - User ID
 * @param {string} userName - User name
 * @returns {Promise<Object>} - Join result
 */
export async function joinRoom(roomCode, userId, userName) {
  try {
    // Validate inputs
    if (!roomCode || !userId || !userName) {
      return {
        success: false,
        error: 'Room code, user ID, and user name are required'
      };
    }
    
    roomCode = roomCode.trim().toUpperCase();
    userName = userName.trim();
    
    if (roomCode.length !== 6 || !/^[A-Z0-9]{6}$/.test(roomCode)) {
      return {
        success: false,
        error: 'Invalid room code format'
      };
    }
    
    if (userName.length === 0 || userName.length > 50) {
      return {
        success: false,
        error: 'User name must be between 1 and 50 characters'
      };
    }
    
    // Find room by code
    const roomsRef = collection(db, 'rooms');
    const q = query(roomsRef, where('roomCode', '==', roomCode));
    const roomsSnapshot = await getDocs(q);
    
    if (roomsSnapshot.empty) {
      return {
        success: false,
        error: 'Room not found'
      };
    }
    
    const roomDoc = roomsSnapshot.docs[0];
    const roomId = roomDoc.id;
    const roomData = roomDoc.data();
    
    // Check if room is accepting participants
    if (roomData.roundStatus === 'completed' || roomData.status === 'completed') {
      return {
        success: false,
        error: 'This room has completed the competition'
      };
    }
    
    // CRITICAL: Check if round 1 has already started - lock entry
    const currentRound = roomData.currentRound || 0;
    const status = roomData.status || roomData.roundStatus || 'waiting';
    
    if (currentRound >= 1 || status !== 'waiting') {
      // Check if user is already a participant in this room
      const existingParticipantRef = doc(db, 'participants', userId);
      const existingParticipantDoc = await getDoc(existingParticipantRef);
      
      if (existingParticipantDoc.exists()) {
        const existingData = existingParticipantDoc.data();
        if (existingData.roomId === roomId) {
          // User is already in this room - allow re-entry but DON'T reset their data
          // (they might be rejoining mid-competition)
          sessionStorage.setItem('roomId', roomId);
          sessionStorage.setItem('roomCode', roomCode);
          return {
            success: true,
            roomId: roomId,
            message: 'Rejoined existing room'
          };
        }
      }
      
      // New user trying to join after round started - BLOCK
      return {
        success: false,
        error: 'This room is no longer accepting new participants. The competition has already started.'
      };
    }
    
    // Add or update participant - CRITICAL: Reset ALL fields to prevent stale data
    // Do NOT use merge: true as it preserves old fields from previous rooms
    const participantRef = doc(db, 'participants', userId);
    
    // First check if user already exists in THIS room (re-joining before round starts)
    const existingDoc = await getDoc(participantRef);
    if (existingDoc.exists()) {
      const existingData = existingDoc.data();
      // If user is already in THIS room and room hasn't started, reset their status
      if (existingData.roomId === roomId) {
        // Room hasn't started yet (status === 'waiting'), so reset fields
        // This handles the case where user was in a previous session of same room
        await setDoc(participantRef, {
          name: userName,
          roomId: roomId,
          status: 'waiting',
          currentRound: 0,
          joinedAt: serverTimestamp(),
          round1Completed: false,
          lastSubmittedRound: 0
        }); // Complete overwrite - reset everything
        
        sessionStorage.setItem('roomId', roomId);
        sessionStorage.setItem('roomCode', roomCode);
        return {
          success: true,
          roomId: roomId,
          message: 'Rejoined room - status reset'
        };
      }
    }
    
    // New participant OR switching rooms - completely reset all fields
    console.log('[JoinRoom] Creating/resetting participant document for user:', userId);
    console.log('[JoinRoom] Setting: status=waiting, roomId=', roomId);
    
    await setDoc(participantRef, {
      name: userName,
      roomId: roomId,
      status: 'waiting', // waiting, active, completed
      currentRound: 0,
      joinedAt: serverTimestamp(),
      // Reset any round-specific data
      round1Completed: false,
      lastSubmittedRound: 0
    }); // NO merge: true - completely overwrite to clear stale data
    
    console.log('[JoinRoom] Participant document created/reset successfully');
    
    // Store room info in sessionStorage
    sessionStorage.setItem('roomId', roomId);
    sessionStorage.setItem('roomCode', roomCode);
    
    return {
      success: true,
      roomId: roomId
    };
  } catch (error) {
    console.error('Join room error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get room data
 * @param {string} roomId - Room ID
 * @returns {Promise<Object>} - Room data
 */
export async function getRoomData(roomId) {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await getDoc(roomRef);
    if (!roomDoc.exists()) {
      return null;
    }
    return {
      id: roomDoc.id,
      ...roomDoc.data()
    };
  } catch (error) {
    console.error('Get room data error:', error);
    return null;
  }
}

/**
 * Get room configuration
 * @param {string} roomId - Room ID
 * @returns {Promise<Object>} - Room configuration
 */
export async function getRoomConfig(roomId) {
  try {
    const configRef = doc(db, 'roomConfig', roomId);
    const configDoc = await getDoc(configRef);
    if (!configDoc.exists()) {
      return null;
    }
    return configDoc.data();
  } catch (error) {
    console.error('Get room config error:', error);
    return null;
  }
}

/**
 * Get all participants in a room
 * @param {string} roomId - Room ID
 * @returns {Promise<Array>} - Array of participants
 */
export async function getRoomParticipants(roomId) {
  try {
    const participantsRef = collection(db, 'participants');
    const q = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(q);
    
    const participants = [];
    participantsSnapshot.forEach(doc => {
      participants.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return participants;
  } catch (error) {
    console.error('Get participants error:', error);
    return [];
  }
}

/**
 * Listen to room changes in real-time
 * @param {string} roomId - Room ID
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export function listenToRoom(roomId, callback) {
  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(roomRef, (doc) => {
    if (doc.exists()) {
      callback({
        id: doc.id,
        ...doc.data()
      });
    }
  });
}

/**
 * Listen to participants in a room
 * @param {string} roomId - Room ID
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export function listenToParticipants(roomId, callback) {
  const participantsRef = collection(db, 'participants');
  const q = query(participantsRef, where('roomId', '==', roomId));
  return onSnapshot(q, (snapshot) => {
    const participants = [];
    snapshot.forEach(doc => {
      participants.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(participants);
  });
}
