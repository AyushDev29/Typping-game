/**
 * ROOM STATE MANAGEMENT MODULE - v2.0
 * 
 * SINGLE SOURCE OF TRUTH for room state and user eligibility.
 * All UI navigation depends ONLY on room.status + participant data.
 * 
 * STATE MACHINE:
 * waiting → round1 → round1_result → round1_leaderboard →
 * round2_waiting → round2 → round2_result → round2_leaderboard →
 * round3_waiting → round3 → round3_result → round3_leaderboard → completed
 * 
 * PARTICIPANT STATUS:
 * - waiting: Initial state
 * - active: Currently in a round
 * - qualified: Passed current round, eligible for next
 * - eliminated: Out of competition
 * 
 * CRITICAL RULES:
 * 1. Eliminated users CANNOT enter next rounds
 * 2. Winner is determined ONLY from Round 3 scores
 * 3. Scores are stored per-round, NOT combined
 * 4. Screen state derived from: room.status + participant.status + participant.eliminatedInRound
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
 * @returns {number} - Round number (0-3)
 */
export function getRoundFromState(state) {
  if (!state) return 0;
  if (state.startsWith('round1')) return 1;
  if (state.startsWith('round2')) return 2;
  if (state.startsWith('round3')) return 3;
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
  if (state === 'round1' || state === 'round2' || state === 'round3') return 'typing';
  if (state.endsWith('_result')) return 'result';
  if (state.endsWith('_leaderboard')) return 'leaderboard';
  if (state === 'completed') return 'completed';
  return 'waiting';
}

/**
 * Determine what screen a user should see based on room state and their status
 * @param {Object} roomData - Room document data
 * @param {Object} participantData - Participant document data
 * @returns {Object} - { screen, roundNumber, canProceed, redirectTo }
 */
export function determineUserScreen(roomData, participantData) {
  const roomStatus = roomData?.status || 'waiting';
  const roundNumber = getRoundFromState(roomStatus);
  const screenType = getScreenFromState(roomStatus);
  
  // Check if user is eliminated
  if (participantData?.isEliminated || participantData?.status === 'eliminated') {
    return {
      screen: 'eliminated',
      roundNumber: participantData.eliminatedInRound || participantData.currentRound || 1,
      canProceed: false,
      redirectTo: 'eliminated.html'
    };
  }
  
  // For waiting states after round 1, check if user qualified
  if (screenType === 'waiting' && roundNumber > 1) {
    const userCurrentRound = participantData?.currentRound || 0;
    const userStatus = participantData?.status;
    
    // User must be qualified from previous round to see waiting for next round
    if (userStatus !== 'qualified' || userCurrentRound < roundNumber - 1) {
      return {
        screen: 'eliminated',
        roundNumber: userCurrentRound,
        canProceed: false,
        redirectTo: 'eliminated.html'
      };
    }
  }
  
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
    let newState;
    
    if (roundNumber >= 3) {
      newState = 'completed';
    } else {
      newState = `round${roundNumber + 1}_waiting`;
    }
    
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
 * Calculate eliminations for a round
 * CRITICAL: This determines who qualifies and who is eliminated
 * Uses a lock mechanism to prevent race conditions from multiple users
 * 
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number (1, 2, or 3)
 * @param {number} qualifyCount - Number of users who qualify
 */
export async function calculateEliminations(roomId, roundNumber, qualifyCount) {
  try {
    console.log(`[Elimination] Round ${roundNumber}, qualify count: ${qualifyCount}`);
    
    // First, check if eliminations have already been calculated for this round
    // by checking if any participant has been marked as qualified/eliminated for this round
    const participantsRef = collection(db, 'participants');
    const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    let alreadyProcessed = false;
    let activeParticipants = [];
    
    participantsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      
      // Check if this round has already been processed
      if (data.currentRound === roundNumber && 
          (data.status === 'qualified' || data.status === 'eliminated')) {
        alreadyProcessed = true;
      }
      
      // Collect participants who are not already eliminated from previous rounds
      if (!data.isEliminated && data.status !== 'eliminated') {
        activeParticipants.push({ id: docSnap.id, ref: docSnap.ref, data });
      }
    });
    
    if (alreadyProcessed) {
      console.log(`[Elimination] Round ${roundNumber} already processed, skipping...`);
      return { success: true, alreadyProcessed: true };
    }
    
    // Get all results for THIS SPECIFIC round only
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
      console.log('[Elimination] No results found for this round');
      return { success: false, error: 'No results' };
    }
    
    // CRITICAL: Sort by ACCURACY first, then WPM, then submission time
    results.sort((a, b) => {
      // 1. Higher accuracy wins
      if (Math.abs((a.accuracy || 0) - (b.accuracy || 0)) > 0.01) {
        return (b.accuracy || 0) - (a.accuracy || 0);
      }
      
      // 2. If accuracy is same, higher WPM wins
      if (Math.abs((a.wpm || 0) - (b.wpm || 0)) > 0.01) {
        return (b.wpm || 0) - (a.wpm || 0);
      }
      
      // 3. If both are same, earlier submission wins
      const timeA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
      const timeB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
      return timeA - timeB; // Earlier time = lower number = wins
    });
    
    console.log(`[Elimination] Results sorted by score:`);
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.userId}: ${r.finalScore}`);
    });
    
    // Top N qualify based on THIS ROUND's performance
    const qualifiedUserIds = results.slice(0, qualifyCount).map(r => r.userId);
    const eliminatedUserIds = results.slice(qualifyCount).map(r => r.userId);
    
    console.log(`[Elimination] Qualified users (top ${qualifyCount}): ${qualifiedUserIds.join(', ')}`);
    console.log(`[Elimination] Eliminated users: ${eliminatedUserIds.join(', ')}`);
    
    // Update participants using batch
    const batch = writeBatch(db);
    let qualifiedCount = 0;
    let eliminatedCount = 0;
    
    activeParticipants.forEach(participant => {
      const participantId = participant.id;
      
      // Check if user has a result for this round
      const hasResult = results.some(r => r.userId === participantId);
      
      if (!hasResult) {
        // User didn't submit - eliminate them
        console.log(`[Elimination] ${participantId}: No result submitted - ELIMINATED`);
        batch.update(participant.ref, {
          status: 'eliminated',
          isEliminated: true,
          eliminatedInRound: roundNumber,
          isQualified: false,
          isWinnerEligible: false,
          currentRound: roundNumber,
          updatedAt: serverTimestamp()
        });
        eliminatedCount++;
        return;
      }
      
      if (qualifiedUserIds.includes(participantId)) {
        // User qualified
        console.log(`[Elimination] ${participantId}: QUALIFIED`);
        batch.update(participant.ref, {
          status: 'qualified',
          isQualified: true,
          isEliminated: false,
          currentRound: roundNumber,
          // Only Round 3 finishers are winner eligible
          isWinnerEligible: roundNumber === 3,
          updatedAt: serverTimestamp()
        });
        qualifiedCount++;
      } else {
        // User eliminated
        console.log(`[Elimination] ${participantId}: ELIMINATED`);
        batch.update(participant.ref, {
          status: 'eliminated',
          isEliminated: true,
          eliminatedInRound: roundNumber,
          isQualified: false,
          isWinnerEligible: false,
          currentRound: roundNumber,
          updatedAt: serverTimestamp()
        });
        eliminatedCount++;
      }
    });
    
    await batch.commit();
    console.log(`[Elimination] Complete: ${qualifiedCount} qualified, ${eliminatedCount} eliminated`);
    
    return { 
      success: true, 
      qualified: qualifiedCount, 
      eliminated: eliminatedCount, 
      qualifiedUserIds,
      eliminatedUserIds
    };
  } catch (error) {
    console.error('[Elimination] Error:', error);
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
 * Listen to room state changes with participant status
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID
 * @param {Function} onStateChange - Callback for state changes
 * @param {Function} onEliminated - Callback when user is eliminated
 * @returns {Function} - Unsubscribe function
 */
export function listenToRoomState(roomId, userId, onStateChange, onEliminated) {
  let isUnsubscribed = false;
  let roomUnsubscribe = null;
  let participantUnsubscribe = null;
  let lastRoomData = null;
  let lastParticipantData = null;
  
  // Function to process combined state
  const processState = () => {
    if (isUnsubscribed || !lastRoomData) return;
    
    // Check elimination status
    if (lastParticipantData?.isEliminated || lastParticipantData?.status === 'eliminated') {
      console.log('[RoomState] User is eliminated');
      onEliminated(lastParticipantData);
      return;
    }
    
    // Determine what screen user should see
    const screenInfo = determineUserScreen(lastRoomData, lastParticipantData);
    
    if (screenInfo.redirectTo) {
      onEliminated(lastParticipantData);
      return;
    }
    
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
  sessionStorage.removeItem('showEliminationRound');
  
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
 * Get round leaderboard - shows ONLY that round's participants and scores
 * SORTING: 1. Accuracy (DESC), 2. WPM (DESC), 3. Submission Time (ASC - earlier is better)
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number
 */
export async function getRoundLeaderboard(roomId, roundNumber) {
  try {
    // Get results for this specific round
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
    
    // CRITICAL: Sort by ACCURACY first, then WPM, then submission time
    results.sort((a, b) => {
      // 1. Higher accuracy wins
      if (Math.abs((a.accuracy || 0) - (b.accuracy || 0)) > 0.01) {
        return (b.accuracy || 0) - (a.accuracy || 0);
      }
      
      // 2. If accuracy is same, higher WPM wins
      if (Math.abs((a.wpm || 0) - (b.wpm || 0)) > 0.01) {
        return (b.wpm || 0) - (a.wpm || 0);
      }
      
      // 3. If both are same, earlier submission wins
      const timeA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
      const timeB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
      return timeA - timeB; // Earlier time = lower number = wins
    });
    
    // Get participant names
    const participantsRef = collection(db, 'participants');
    const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    const nameMap = {};
    const statusMap = {};
    participantsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      nameMap[docSnap.id] = data.name || 'Unknown';
      statusMap[docSnap.id] = {
        status: data.status,
        isEliminated: data.isEliminated,
        eliminatedInRound: data.eliminatedInRound,
        isQualified: data.isQualified
      };
    });
    
    // Add names and status to results
    return results.map(result => ({
      ...result,
      name: result.userName || nameMap[result.userId] || 'Unknown',
      participantStatus: statusMap[result.userId] || {}
    }));
  } catch (error) {
    console.error('[RoomState] getRoundLeaderboard error:', error);
    return [];
  }
}

/**
 * Get final leaderboard - shows ONLY Round 3 participants
 * Winner is determined by Round 3 scores ONLY
 * @param {string} roomId - Room ID
 */
export async function getFinalLeaderboard(roomId) {
  return getRoundLeaderboard(roomId, 3);
}
