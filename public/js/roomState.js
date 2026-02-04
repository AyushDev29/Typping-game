/**
 * ROOM STATE MANAGEMENT MODULE - Single Round Version
 * 
 * STATE MACHINE:
 * waiting → round1 → round1_result → round1_leaderboard → completed
 * 
 * PARTICIPANT STATUS:
 * - waiting: Initial state
 * - active: Currently in the round
 * - completed: Finished the round
 */

import { db } from './firebase.js';
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Screen timeouts (in seconds)
export const TIMEOUTS = {
  RESULT_SCREEN: 20,
  LEADERBOARD_SCREEN: 15
};

/**
 * Get round number from state
 * @param {string} state - Room status
 * @returns {number} - Round number (0-1)
 */
export function getRoundFromState(state) {
  if (!state) return 0;
  if (state.startsWith('round1')) return 1;
  return 0;
}

/**
 * Get screen type from state
 * @param {string} state - Room status
 * @returns {string} - Screen type
 */
export function getScreenFromState(state) {
  if (!state) return 'waiting';
  if (state === 'waiting' || state.endsWith('_waiting')) return 'waiting';
  if (state === 'round1') return 'typing';
  if (state.endsWith('_result')) return 'result';
  if (state.endsWith('_leaderboard')) return 'leaderboard';
  if (state === 'completed') return 'completed';
  return 'waiting';
}

/**
 * Determine what screen a user should see based on room state
 * @param {Object} roomData - Room document data
 * @param {Object} participantData - Participant document data
 * @returns {Object} - { screen, roundNumber, canProceed, redirectTo }
 */
export function determineUserScreen(roomData, participantData) {
  const roomStatus = roomData?.status || 'waiting';
  const roundNumber = getRoundFromState(roomStatus);
  const screenType = getScreenFromState(roomStatus);
  
  return {
    screen: screenType,
    roundNumber: roundNumber,
    canProceed: true,
    redirectTo: null
  };
}

/**
 * Transition room to result state
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number
 */
export async function transitionToResult(roomId, roundNumber) {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const newState = `round${roundNumber}_result`;
    
    await updateDoc(roomRef, {
      status: newState,
      roundEndedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    console.log(`[RoomState] Transitioned to ${newState}`);
    return { success: true };
  } catch (error) {
    console.error('[RoomState] transitionToResult error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Transition room to leaderboard state
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number
 */
export async function transitionToLeaderboard(roomId, roundNumber) {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const newState = `round${roundNumber}_leaderboard`;
    
    await updateDoc(roomRef, {
      status: newState,
      lastUpdated: serverTimestamp()
    });
    
    console.log(`[RoomState] Transitioned to ${newState}`);
    return { success: true };
  } catch (error) {
    console.error('[RoomState] transitionToLeaderboard error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Transition room to next waiting or completed
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Current round number
 */
export async function transitionToNextWaiting(roomId, roundNumber) {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const newState = 'completed';
    
    await updateDoc(roomRef, {
      status: newState,
      lastUpdated: serverTimestamp()
    });
    
    console.log(`[RoomState] Transitioned to ${newState}`);
    return { success: true };
  } catch (error) {
    console.error('[RoomState] transitionToNextWaiting error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate results for the round
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number (always 1)
 * @param {number} qualifyCount - Number of winners
 */
export async function calculateResults(roomId, roundNumber, qualifyCount) {
  try {
    console.log(`[Results] Processing round ${roundNumber}, winner count: ${qualifyCount}`);
    
    // Get all results for the round
    const resultsRef = collection(db, 'results');
    const q = query(
      resultsRef,
      where('roomId', '==', roomId),
      where('round', '==', roundNumber)
    );
    const snapshot = await getDocs(q);
    
    let results = [];
    snapshot.forEach(docSnap => {
      results.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    if (results.length === 0) {
      console.log('[Results] No results found for this round');
      return { success: false, error: 'No results' };
    }
    
    // CRITICAL: Sort by MonkeyType methodology - Net WPM first, then accuracy, then submission time
    results.sort((a, b) => {
      // 1. Higher Net WPM wins (primary ranking metric)
      const wpmA = a.netWpm || a.wpm || 0;
      const wpmB = b.netWpm || b.wpm || 0;
      if (Math.abs(wpmA - wpmB) > 0.01) {
        return wpmB - wpmA;
      }
      
      // 2. If WPM is same, higher accuracy wins
      if (Math.abs((a.accuracy || 0) - (b.accuracy || 0)) > 0.01) {
        return (b.accuracy || 0) - (a.accuracy || 0);
      }
      
      // 3. If both are same, earlier submission wins
      const timeA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
      const timeB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
      return timeA - timeB; // Earlier time = lower number = wins
    });
    
    console.log(`[Results] Results sorted by Net WPM:`);
    results.forEach((r, i) => {
      const wpm = r.netWpm || r.wpm || 0;
      const isQualified = (i + 1) <= qualifyCount;
      console.log(`  ${i + 1}. ${r.userId}: ${wpm} WPM, ${r.accuracy}% accuracy - ${isQualified ? 'QUALIFIED' : 'ELIMINATED'}`);
    });
    
    // Update participants with qualification status
    const participantsRef = collection(db, 'participants');
    const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    const batch = writeBatch(db);
    let completedCount = 0;
    let qualifiedCount = 0;
    let eliminatedCount = 0;
    
    // Create a map of user results for quick lookup
    const userResultsMap = {};
    results.forEach((result, index) => {
      userResultsMap[result.userId] = {
        rank: index + 1,
        isQualified: (index + 1) <= qualifyCount,
        ...result
      };
    });
    
    participantsSnapshot.forEach(docSnap => {
      const userId = docSnap.id;
      const userResult = userResultsMap[userId];
      
      if (userResult) {
        // User has a result - update with qualification status
        batch.update(docSnap.ref, {
          status: userResult.isQualified ? 'qualified' : 'eliminated',
          currentRound: roundNumber,
          finalRank: userResult.rank,
          isQualified: userResult.isQualified,
          updatedAt: serverTimestamp()
        });
        
        if (userResult.isQualified) {
          qualifiedCount++;
        } else {
          eliminatedCount++;
        }
      } else {
        // User didn't submit - mark as eliminated
        batch.update(docSnap.ref, {
          status: 'eliminated',
          currentRound: roundNumber,
          finalRank: results.length + 1, // Last place
          isQualified: false,
          updatedAt: serverTimestamp()
        });
        eliminatedCount++;
      }
      completedCount++;
    });
    
    await batch.commit();
    console.log(`[Results] Complete: ${completedCount} participants processed, ${qualifiedCount} qualified, ${eliminatedCount} eliminated`);
    
    return { 
      success: true, 
      completed: completedCount,
      qualified: qualifiedCount,
      eliminated: eliminatedCount,
      results: results
    };
  } catch (error) {
    console.error('[Results] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get participant data
 * @param {string} userId - User ID
 */
export async function getParticipantData(userId) {
  try {
    const participantRef = doc(db, 'participants', userId);
    const participantDoc = await getDoc(participantRef);
    
    if (participantDoc.exists()) {
      return { id: participantDoc.id, ...participantDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('[RoomState] getParticipantData error:', error);
    return null;
  }
}

/**
 * Listen to room state changes
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID
 * @param {Function} onStateChange - Callback for state changes
 * @returns {Function} - Unsubscribe function
 */
export function listenToRoomState(roomId, userId, onStateChange) {
  let isUnsubscribed = false;
  let roomUnsubscribe = null;
  let participantUnsubscribe = null;
  let lastRoomData = null;
  let lastParticipantData = null;
  
  // Function to process combined state
  const processState = () => {
    if (isUnsubscribed || !lastRoomData) return;
    
    // Determine what screen user should see
    const screenInfo = determineUserScreen(lastRoomData, lastParticipantData);
    
    // Pass combined data to state handler
    onStateChange({
      ...lastRoomData,
      participantData: lastParticipantData,
      screenInfo: screenInfo
    });
  };
  
  // Listen to participant status
  const participantRef = doc(db, 'participants', userId);
  participantUnsubscribe = onSnapshot(participantRef, (docSnap) => {
    if (isUnsubscribed) return;
    
    if (docSnap.exists()) {
      lastParticipantData = { id: docSnap.id, ...docSnap.data() };
      processState();
    }
  }, (error) => {
    console.error('[RoomState] Participant listener error:', error);
  });
  
  // Listen to room state
  const roomRef = doc(db, 'rooms', roomId);
  roomUnsubscribe = onSnapshot(roomRef, (docSnap) => {
    if (isUnsubscribed) return;
    
    if (docSnap.exists()) {
      lastRoomData = { id: docSnap.id, ...docSnap.data() };
      processState();
    }
  }, (error) => {
    console.error('[RoomState] Room listener error:', error);
  });
  
  // Return unsubscribe function
  return () => {
    isUnsubscribed = true;
    if (roomUnsubscribe) roomUnsubscribe();
    if (participantUnsubscribe) participantUnsubscribe();
  };
}

/**
 * Exit game - clears room data but keeps user logged in
 */
export function exitGame() {
  // Clear room-related session storage
  sessionStorage.removeItem('roomId');
  sessionStorage.removeItem('roomCode');
  
  // Clear localStorage submission data for this room
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('submitted_') || 
      key.startsWith('score_') || 
      key.startsWith('result_') ||
      key.startsWith('timerStart_')
    )) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Redirect to join room (dashboard for participants)
  window.location.href = 'join-room.html';
}

/**
 * Get round leaderboard - shows the round's participants and scores
 * SORTING: 1. Net WPM (DESC), 2. Accuracy (DESC), 3. Submission Time (ASC - earlier is better)
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number (always 1)
 */
export async function getRoundLeaderboard(roomId, roundNumber) {
  try {
    // Get ALL participants in the room first
    const participantsRef = collection(db, 'participants');
    const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    if (participantsSnapshot.empty) {
      return [];
    }
    
    // Create participants map with all participants
    const allParticipants = {};
    participantsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      allParticipants[docSnap.id] = {
        userId: docSnap.id,
        name: data.name || 'Unknown',
        status: data.status || 'active',
        isQualified: data.isQualified || false,
        finalRank: data.finalRank || null,
        // Default values for participants without results
        wpm: 0,
        accuracy: 0,
        accuracyPoints: 0,
        speedPoints: 0,
        finalScore: 0,
        submittedAt: null
      };
    });
    
    // Get results for this specific round
    const resultsRef = collection(db, 'results');
    const q = query(
      resultsRef,
      where('roomId', '==', roomId),
      where('round', '==', roundNumber)
    );
    const snapshot = await getDocs(q);
    
    // Update participants with their actual results
    snapshot.forEach(docSnap => {
      const result = docSnap.data();
      if (allParticipants[result.userId]) {
        // If accuracyPoints and speedPoints don't exist, calculate them from existing data
        let accuracyPoints = result.accuracyPoints || 0;
        let speedPoints = result.speedPoints || 0;
        let finalScore = result.finalScore || 0;
        
        // Recalculate points if they're missing (for backward compatibility)
        if (accuracyPoints === 0 && speedPoints === 0 && (result.accuracy > 0 || result.wpm > 0)) {
          const accuracy = result.accuracy || 0;
          const wpm = result.netWpm || result.wpm || 0;
          
          // Calculate tiered accuracy points
          if (accuracy >= 100) {
            accuracyPoints = 60;
          } else if (accuracy >= 95) {
            accuracyPoints = 55;
          } else if (accuracy >= 90) {
            accuracyPoints = 50;
          } else if (accuracy >= 80) {
            accuracyPoints = 40;
          } else if (accuracy >= 70) {
            accuracyPoints = 30;
          } else {
            accuracyPoints = Math.round((accuracy / 70) * 20);
          }
          
          // Calculate tiered speed points
          if (wpm >= 60) {
            speedPoints = 40;
          } else if (wpm >= 50) {
            speedPoints = 35;
          } else if (wpm >= 40) {
            speedPoints = 30;
          } else if (wpm >= 30) {
            speedPoints = 25;
          } else if (wpm >= 20) {
            speedPoints = 15;
          } else {
            speedPoints = Math.round((wpm / 20) * 10);
          }
          
          finalScore = accuracyPoints + speedPoints;
        }
        
        allParticipants[result.userId] = {
          ...allParticipants[result.userId],
          ...result,
          accuracyPoints: accuracyPoints,
          speedPoints: speedPoints,
          finalScore: finalScore,
          name: result.userName || allParticipants[result.userId].name
        };
      }
    });
    
    // Convert to array and sort by Final Score (highest first), then accuracy, then WPM, then submission time
    let results = Object.values(allParticipants);
    
    results.sort((a, b) => {
      if (Math.abs((a.finalScore || 0) - (b.finalScore || 0)) > 0.01) {
        return (b.finalScore || 0) - (a.finalScore || 0);
      }
      
      if (Math.abs((a.accuracy || 0) - (b.accuracy || 0)) > 0.01) {
        return (b.accuracy || 0) - (a.accuracy || 0);
      }
      
      if (Math.abs((a.wpm || 0) - (b.wpm || 0)) > 0.01) {
        return (b.wpm || 0) - (a.wpm || 0);
      }
      
      const timeA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : Number.MAX_SAFE_INTEGER;
      const timeB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });
    
    return results;
  } catch (error) {
    console.error('getRoundLeaderboard error:', error);
    return [];
  }
}
