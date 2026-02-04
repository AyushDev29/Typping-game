/**
 * Admin Module
 * 
 * Handles admin-specific operations:
 * - Starting rounds (admin only)
 * - Viewing results
 * 
 * NOTE: Round ending is now AUTOMATIC via state machine
 * Admin does NOT manually end rounds
 */

import { db } from './firebase.js';
import { getRoomConfig } from './room.js';
import { calculateScore } from './scoring.js';
import { calculateResults } from './roomState.js';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Start a round (Admin only)
 * Uses state machine: status = 'round1'
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number (always 1)
 * @returns {Promise<Object>} - Result
 */
export async function startRound(roomId, roundNumber) {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await getDoc(roomRef);
    
    if (!roomDoc.exists()) {
      return { success: false, error: 'Room not found' };
    }
    
    const currentStatus = roomDoc.data().status || 'waiting';
    
    // Only allow starting round 1 from waiting state
    if (roundNumber !== 1 || currentStatus !== 'waiting') {
      return { 
        success: false, 
        error: `Cannot start round from state: ${currentStatus}` 
      };
    }
    
    // Update room with new state machine status
    await updateDoc(roomRef, {
      status: 'round1',
      currentRound: 1,
      roundStatus: 'active', // Keep for backward compatibility
      roundStartedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    // Update participants to 'active' status
    const participantsRef = collection(db, 'participants');
    const q = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    participantsSnapshot.forEach(docSnap => {
      batch.update(docSnap.ref, {
        status: 'active',
        currentRound: 1
      });
    });
    await batch.commit();
    
    console.log(`[Admin] Started round ${roundNumber}`);
    
    return { success: true };
  } catch (error) {
    console.error('Start round error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * End the round and calculate qualifications
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number (always 1)
 * @returns {Promise<Object>} - Result
 */
export async function endRound(roomId, roundNumber) {
  try {
    console.log(`Ending round ${roundNumber} for room ${roomId}`);
    
    // Get room config to determine winner count
    const configRef = doc(db, 'roomConfig', roomId);
    const configDoc = await getDoc(configRef);
    let qualifyCount = 3; // Default
    if (configDoc.exists()) {
      qualifyCount = configDoc.data().rounds?.r1?.qualifyCount || 3;
    }
    
    // Calculate results and determine qualifications
    const resultsCalculation = await calculateResults(roomId, roundNumber, qualifyCount);
    
    // Update room status to completed
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      status: 'completed',
      roundStatus: 'completed',
      currentRound: 1,
      roundEndedAt: serverTimestamp(),
      qualifyCount: qualifyCount,
      totalParticipants: resultsCalculation.results?.length || 0
    });
    
    console.log(`Round ${roundNumber} ended successfully. ${qualifyCount} participants qualified.`);
    return {
      success: true,
      qualifyCount: qualifyCount,
      totalParticipants: resultsCalculation.results?.length || 0
    };
  } catch (error) {
    console.error('End round error:', error);
    return {
      success: false,
      error: error.message || 'Failed to end round. Check console for details.'
    };
  }
}

/**
 * Submit typing result
 * @param {string} userId - User ID
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number
 * @param {string} originalText - Original paragraph
 * @param {string} typedText - Typed text
 * @param {number} timeInSeconds - Time taken
 * @param {string} userName - User's game name (optional, will be fetched if not provided)
 * @returns {Promise<Object>} - Result
 */
export async function submitTypingResult(userId, roomId, roundNumber, originalText, typedText, timeInSeconds, userName = null) {
  try {
    // Validate inputs
    if (!userId || !roomId || !roundNumber || !originalText || typeof typedText !== 'string' || !timeInSeconds) {
      return {
        success: false,
        error: 'Invalid input parameters'
      };
    }
    
    if (timeInSeconds <= 0 || timeInSeconds > 3600) {
      return {
        success: false,
        error: 'Invalid time value'
      };
    }
    
    // Get user's game name from participants if not provided
    if (!userName) {
      try {
        const participantRef = doc(db, 'participants', userId);
        const participantDoc = await getDoc(participantRef);
        if (participantDoc.exists()) {
          userName = participantDoc.data().name || 'Unknown';
        }
      } catch (e) {
        console.warn('Could not fetch participant name:', e);
        userName = 'Unknown';
      }
    }
    
    // Check if result already exists (prevent duplicate submissions)
    const resultsRef = collection(db, 'results');
    const existingQuery = query(
      resultsRef,
      where('userId', '==', userId),
      where('roomId', '==', roomId),
      where('round', '==', roundNumber)
    );
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      // Result already exists - return existing score
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      return {
        success: true,
        score: {
          accuracy: existingData.accuracy,
          wpm: existingData.wpm,
          accuracyPoints: existingData.accuracyPoints || 0,
          speedPoints: existingData.speedPoints || 0,
          finalScore: existingData.finalScore
        },
        alreadySubmitted: true
      };
    }
    
    // Calculate score
    const score = calculateScore(originalText, typedText, timeInSeconds);
    
    // Validate score values
    if (isNaN(score.accuracy) || isNaN(score.wpm) || isNaN(score.finalScore)) {
      return {
        success: false,
        error: 'Invalid score calculation'
      };
    }
    
    // Store result in Firestore - INCLUDING the userName for easy leaderboard display
    await addDoc(resultsRef, {
      userId: userId,
      roomId: roomId,
      round: roundNumber,
      userName: userName,  // Store the game name directly in results
      wpm: score.wpm,
      netWpm: score.netWpm,
      rawWpm: score.rawWpm,
      accuracy: score.accuracy,
      accuracyPoints: score.accuracyPoints,
      speedPoints: score.speedPoints,
      finalScore: score.finalScore,
      correctChars: score.correctChars,
      incorrectChars: score.incorrectChars,
      totalCharsTyped: score.totalCharsTyped,
      totalCharsExpected: score.totalCharsExpected,
      timeInSeconds: timeInSeconds,
      submittedAt: serverTimestamp()
    });
    
    return {
      success: true,
      score: score
    };
  } catch (error) {
    console.error('Submit result error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get leaderboard for the single round
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number (always 1)
 * @returns {Promise<Array>} - Leaderboard array with participant names
 */
export async function getLeaderboard(roomId, roundNumber) {
  try {
    console.log(`[Leaderboard] Getting leaderboard for room ${roomId}, round ${roundNumber}`);
    
    // Get all participants in the room
    const participantsRef = collection(db, 'participants');
    const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    if (participantsSnapshot.empty) {
      return [];
    }
    
    // Create participants map
    const participantsMap = {};
    participantsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      participantsMap[docSnap.id] = {
        name: data.name || 'Unknown',
        status: data.status || 'active',
        currentRound: data.currentRound || 1
      };
    });
    
    // Get results for the round
    const resultsRef = collection(db, 'results');
    let currentRoundResults = [];
    
    try {
      // Try query with index (preferred method)
      const q = query(
        resultsRef,
        where('roomId', '==', roomId),
        where('round', '==', roundNumber),
        orderBy('finalScore', 'desc')
      );
      const resultsSnapshot = await getDocs(q);
      
      resultsSnapshot.forEach(docSnap => {
        const result = docSnap.data();
        currentRoundResults.push({
          id: docSnap.id,
          ...result
        });
      });
    } catch (indexError) {
      // If index error, try without orderBy and sort in memory
      if (indexError.code === 'failed-precondition') {
        console.warn('Index not ready for leaderboard, using fallback query...');
        const q = query(
          resultsRef,
          where('roomId', '==', roomId),
          where('round', '==', roundNumber)
        );
        const resultsSnapshot = await getDocs(q);
        
        resultsSnapshot.forEach(docSnap => {
          const result = docSnap.data();
          currentRoundResults.push({
            id: docSnap.id,
            ...result
          });
        });
        
        // CRITICAL: Sort by MonkeyType methodology - Net WPM first, then accuracy, then submission time
        currentRoundResults.sort((a, b) => {
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
      } else {
        throw indexError; // Re-throw if it's a different error
      }
    }
    
    const leaderboard = [];
    
    // Add users who have results for this round
    currentRoundResults.forEach(result => {
      const participant = participantsMap[result.userId];
      leaderboard.push({
        ...result,
        name: result.userName || participant?.name || 'Unknown',
        status: 'Participant'
      });
    });
    
    return leaderboard;
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return [];
  }
}

/**
 * Listen to leaderboard changes
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number
 * @param {Function} callback - Callback function
 * @returns {Function} - Unsubscribe function
 */
export function listenToLeaderboard(roomId, roundNumber, callback) {
  const resultsRef = collection(db, 'results');
  
  // Try query with index first
  const q = query(
    resultsRef,
    where('roomId', '==', roomId),
    where('round', '==', roundNumber),
    orderBy('finalScore', 'desc')
  );
  
  let unsubscribeFn = null;
  let pollInterval = null;
  
  try {
    // Try to set up real-time listener
    unsubscribeFn = onSnapshot(q, async (snapshot) => {
      // Use the enhanced getLeaderboard function instead of processing here
      const leaderboard = await getLeaderboard(roomId, roundNumber);
      callback(leaderboard);
    }, (error) => {
      // Handle index errors gracefully - use polling fallback
      if (error.code === 'failed-precondition') {
        console.warn('Index not ready for real-time listener. Using polling fallback...');
        
        // Fallback: Poll leaderboard every 2 seconds
        pollInterval = setInterval(async () => {
          try {
            const leaderboard = await getLeaderboard(roomId, roundNumber);
            callback(leaderboard);
          } catch (pollError) {
            console.error('Polling fallback error:', pollError);
            callback([]);
          }
        }, 2000);
      } else {
        console.error('Leaderboard listener error:', error);
        callback([]);
      }
    });
    
    // Return unsubscribe function
    return () => {
      if (unsubscribeFn) {
        unsubscribeFn();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  } catch (error) {
    // If listener setup fails, use polling immediately
    console.warn('Failed to set up real-time listener. Using polling fallback...');
    
    pollInterval = setInterval(async () => {
      try {
        const leaderboard = await getLeaderboard(roomId, roundNumber);
        callback(leaderboard);
      } catch (pollError) {
        console.error('Polling fallback error:', pollError);
        callback([]);
      }
    }, 2000);
    
    // Return unsubscribe function
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }
}


/**
 * AUTO END ROUND - Called automatically when timer expires
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number (always 1)
 * @returns {Promise<Object>} - Result
 */
export async function autoEndRound(roomId, roundNumber) {
  try {
    console.log(`[AutoEnd] Attempting to auto-end round ${roundNumber} for room ${roomId}`);
    
    // Update room status to completed
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      status: 'completed',
      roundStatus: 'completed',
      currentRound: 1,
      roundEndedAt: serverTimestamp()
    });
    
    console.log(`[AutoEnd] Round ${roundNumber} auto-ended successfully`);
    
    return {
      success: true
    };
    
  } catch (error) {
    console.error('[AutoEnd] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}


/**
 * Delete a room and all its associated data
 * @param {string} roomId - Room ID to delete
 * @returns {Promise<Object>} - Result
 */
export async function deleteRoom(roomId) {
  try {
    console.log(`[DeleteRoom] Deleting room ${roomId} and all associated data...`);
    
    // Delete all results for this room
    const resultsRef = collection(db, 'results');
    const resultsQuery = query(resultsRef, where('roomId', '==', roomId));
    const resultsSnapshot = await getDocs(resultsQuery);
    
    const batch1 = writeBatch(db);
    let resultCount = 0;
    resultsSnapshot.forEach(docSnap => {
      batch1.delete(docSnap.ref);
      resultCount++;
    });
    if (resultCount > 0) {
      await batch1.commit();
      console.log(`[DeleteRoom] Deleted ${resultCount} results`);
    }
    
    // Delete all participants for this room
    const participantsRef = collection(db, 'participants');
    const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    const batch2 = writeBatch(db);
    let participantCount = 0;
    participantsSnapshot.forEach(docSnap => {
      batch2.delete(docSnap.ref);
      participantCount++;
    });
    if (participantCount > 0) {
      await batch2.commit();
      console.log(`[DeleteRoom] Deleted ${participantCount} participants`);
    }
    
    // Delete room config
    const configRef = doc(db, 'roomConfig', roomId);
    const configDoc = await getDoc(configRef);
    if (configDoc.exists()) {
      await deleteDoc(configRef);
      console.log(`[DeleteRoom] Deleted room config`);
    }
    
    // Delete the room itself
    const roomRef = doc(db, 'rooms', roomId);
    await deleteDoc(roomRef);
    console.log(`[DeleteRoom] Deleted room document`);
    
    return {
      success: true,
      deleted: {
        results: resultCount,
        participants: participantCount
      }
    };
  } catch (error) {
    console.error('[DeleteRoom] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clear/delete results for a specific round in a room
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number to clear (1, 2, or 3)
 * @returns {Promise<Object>} - Result
 */
export async function clearRoundResults(roomId, roundNumber) {
  try {
    console.log(`[ClearRound] Clearing results for round ${roundNumber} in room ${roomId}...`);
    
    // Get all results for this round
    const resultsRef = collection(db, 'results');
    const resultsQuery = query(
      resultsRef,
      where('roomId', '==', roomId),
      where('round', '==', roundNumber)
    );
    const resultsSnapshot = await getDocs(resultsQuery);
    
    if (resultsSnapshot.empty) {
      return {
        success: true,
        deleted: 0,
        message: 'No results found for this round'
      };
    }
    
    // Delete all results for this round
    const batch = writeBatch(db);
    let count = 0;
    resultsSnapshot.forEach(docSnap => {
      batch.delete(docSnap.ref);
      count++;
    });
    await batch.commit();
    
    console.log(`[ClearRound] Deleted ${count} results for round ${roundNumber}`);
    
    return {
      success: true,
      deleted: count
    };
  } catch (error) {
    console.error('[ClearRound] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
