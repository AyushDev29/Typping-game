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
 * Uses new state machine: status = 'round1', 'round2', 'round3'
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number (1, 2, or 3)
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
    
    // Validate state transition
    const validTransitions = {
      'waiting': 'round1',
      'round1_leaderboard': 'round2',
      'round2_waiting': 'round2',
      'round2_leaderboard': 'round3',
      'round3_waiting': 'round3'
    };
    
    const expectedStatus = `round${roundNumber}`;
    const canTransition = validTransitions[currentStatus] === expectedStatus ||
                          currentStatus === `round${roundNumber}_waiting`;
    
    if (!canTransition && roundNumber > 1) {
      return { 
        success: false, 
        error: `Cannot start round ${roundNumber} from state: ${currentStatus}` 
      };
    }
    
    // Update room with new state machine status
    await updateDoc(roomRef, {
      status: `round${roundNumber}`,
      currentRound: roundNumber,
      roundStatus: 'active', // Keep for backward compatibility
      roundStartedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    
    // Update non-eliminated participants to 'active' status
    const participantsRef = collection(db, 'participants');
    const q = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    participantsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      // Only update non-eliminated participants
      if (data.status !== 'eliminated' && !data.isEliminated) {
        batch.update(docSnap.ref, {
          status: 'active',
          currentRound: roundNumber
        });
      }
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
 * End a round and calculate eliminations
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number
 * @returns {Promise<Object>} - Result
 */
export async function endRound(roomId, roundNumber) {
  try {
    console.log(`Ending round ${roundNumber} for room ${roomId}`);
    
    // Get room configuration
    const config = await getRoomConfig(roomId);
    if (!config) {
      return { success: false, error: 'Room config not found' };
    }
    
    const roundConfig = config.rounds[`r${roundNumber}`];
    if (!roundConfig) {
      return { success: false, error: `Round ${roundNumber} config not found` };
    }
    
    const qualifyCount = roundConfig.qualifyCount;
    console.log(`Qualify count for round ${roundNumber}: ${qualifyCount}`);
    
    // Get all results for this round - try with index first, fallback if needed
    const resultsRef = collection(db, 'results');
    let results = [];
    
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
        results.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      console.log(`Found ${results.length} results using indexed query`);
    } catch (indexError) {
      // If index error, try without orderBy and sort in memory
      if (indexError.code === 'failed-precondition') {
        console.warn('Index not ready, fetching all results and sorting in memory...');
        const q = query(
          resultsRef,
          where('roomId', '==', roomId),
          where('round', '==', roundNumber)
        );
        const resultsSnapshot = await getDocs(q);
        
        resultsSnapshot.forEach(docSnap => {
          results.push({
            id: docSnap.id,
            ...docSnap.data()
          });
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
        console.log(`Found ${results.length} results using fallback query`);
      } else {
        throw indexError; // Re-throw if it's a different error
      }
    }
    
    if (results.length === 0) {
      return { success: false, error: 'No results found for this round. Participants must submit their typing results first.' };
    }
    
    // Determine who qualifies (top N by finalScore)
    const qualifiedUserIds = results.slice(0, qualifyCount).map(r => r.userId);
    console.log(`Qualified user IDs: ${qualifiedUserIds.join(', ')}`);
    
    // Update participant statuses
    const participantsRef = collection(db, 'participants');
    const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    if (participantsSnapshot.empty) {
      return { success: false, error: 'No participants found in this room' };
    }
    
    const batch = writeBatch(db);
    let qualifiedCount = 0;
    let eliminatedCount = 0;
    
    participantsSnapshot.forEach(docSnap => {
      const participantData = docSnap.data();
      const participantUserId = docSnap.id; // Document ID is the userId
      
      if (qualifiedUserIds.includes(participantUserId)) {
        // Qualified
        batch.update(docSnap.ref, {
          status: 'qualified',
          currentRound: roundNumber
        });
        qualifiedCount++;
      } else {
        // Eliminated
        batch.update(docSnap.ref, {
          status: 'eliminated',
          currentRound: roundNumber
        });
        eliminatedCount++;
      }
    });
    
    console.log(`Updating ${qualifiedCount} qualified and ${eliminatedCount} eliminated participants`);
    await batch.commit();
    
    // Update room status
    const roomRef = doc(db, 'rooms', roomId);
    if (roundNumber === 3) {
      // Competition complete
      await updateDoc(roomRef, {
        roundStatus: 'completed',
        currentRound: 3
      });
    } else {
      // Move to waiting for next round
      await updateDoc(roomRef, {
        roundStatus: 'waiting',
        currentRound: roundNumber
      });
    }
    
    console.log(`Round ${roundNumber} ended successfully`);
    return {
      success: true,
      qualified: qualifiedCount,
      eliminated: eliminatedCount
    };
  } catch (error) {
    console.error('End round error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
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
      accuracy: score.accuracy,
      finalScore: score.finalScore,
      correctChars: score.correctChars,
      totalChars: score.totalChars,
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
 * Get leaderboard for a round - Enhanced to show both qualified and eliminated users
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number
 * @returns {Promise<Array>} - Leaderboard array with status information
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
    
    // Get results for the requested round
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
        
        // CRITICAL: Sort by ACCURACY first, then WPM, then submission time
        currentRoundResults.sort((a, b) => {
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
      } else {
        throw indexError; // Re-throw if it's a different error
      }
    }
    
    const leaderboard = [];
    const usersWithCurrentResults = new Set(currentRoundResults.map(r => r.userId));
    
    // Add users who have results for this round
    currentRoundResults.forEach(result => {
      const participant = participantsMap[result.userId];
      leaderboard.push({
        ...result,
        name: result.userName || participant?.name || 'Unknown',
        status: getParticipantStatusForRound(participant, roundNumber)
      });
    });
    
    // For Round 2+: Add users who were eliminated in previous rounds
    if (roundNumber > 1) {
      const eliminatedUsers = Object.keys(participantsMap).filter(userId => {
        const participant = participantsMap[userId];
        return !usersWithCurrentResults.has(userId) && 
               participant.status === 'eliminated' && 
               participant.currentRound < roundNumber;
      });
      
      // Get results for eliminated users from their last round
      if (eliminatedUsers.length > 0) {
        const eliminatedResults = await getResultsForEliminatedUsers(roomId, eliminatedUsers, participantsMap);
        eliminatedResults.forEach(result => {
          leaderboard.push({
            ...result,
            status: 'Eliminated',
            isFromPreviousRound: true
          });
        });
      }
    }
    
    // CRITICAL: Sort by ACCURACY first, then WPM, then submission time
    // Keep eliminated users at bottom
    leaderboard.sort((a, b) => {
      // If one is eliminated and other is not, non-eliminated comes first
      if (a.status === 'Eliminated' && b.status !== 'Eliminated') return 1;
      if (b.status === 'Eliminated' && a.status !== 'Eliminated') return -1;
      
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
    
    return leaderboard;
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return [];
  }
}

/**
 * Helper function to get participant status for display
 */
function getParticipantStatusForRound(participant, roundNumber) {
  if (!participant) return 'Unknown';
  
  if (participant.status === 'eliminated') {
    return 'Eliminated';
  } else if (participant.status === 'qualified') {
    return 'Qualified';
  } else {
    // For active participants, determine status based on round
    return roundNumber === 3 ? 'Finalist' : 'Qualified';
  }
}

/**
 * Helper function to get results for eliminated users from their last round
 */
async function getResultsForEliminatedUsers(roomId, eliminatedUserIds, participantsMap) {
  try {
    const resultsRef = collection(db, 'results');
    const results = [];
    
    // Get results for each eliminated user from their elimination round
    for (const userId of eliminatedUserIds) {
      const participant = participantsMap[userId];
      const eliminationRound = participant.currentRound;
      
      const q = query(
        resultsRef,
        where('roomId', '==', roomId),
        where('userId', '==', userId),
        where('round', '==', eliminationRound)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const result = doc.data();
        results.push({
          id: doc.id,
          ...result,
          name: result.userName || participant.name || 'Unknown'
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error getting eliminated user results:', error);
    return [];
  }
}

/**
 * Get leaderboard for eliminated users - shows the round they were eliminated in
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID of eliminated user
 * @returns {Promise<Array>} - Leaderboard array from elimination round
 */
export async function getEliminatedUserLeaderboard(roomId, userId) {
  try {
    // Get the user's participant data to find their elimination round
    const participantRef = doc(db, 'participants', userId);
    const participantDoc = await getDoc(participantRef);
    
    if (!participantDoc.exists()) {
      return [];
    }
    
    const participantData = participantDoc.data();
    const eliminationRound = participantData.currentRound || 1;
    
    console.log(`[EliminatedLeaderboard] User ${userId} was eliminated in round ${eliminationRound}`);
    
    // Get the leaderboard for their elimination round
    return await getLeaderboard(roomId, eliminationRound);
  } catch (error) {
    console.error('Get eliminated user leaderboard error:', error);
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
 * 
 * This function is called by users when their timer ends.
 * It calculates eliminations and updates participant statuses.
 * 
 * IMPORTANT: This is safe to call multiple times - it checks if the round
 * has already been processed before making changes.
 * 
 * @param {string} roomId - Room ID
 * @param {number} roundNumber - Round number
 * @returns {Promise<Object>} - Result
 */
export async function autoEndRound(roomId, roundNumber) {
  try {
    console.log(`[AutoEnd] Attempting to auto-end round ${roundNumber} for room ${roomId}`);
    
    // First, check if the round has already been processed
    // We do this by checking if any participants have 'qualified' or 'eliminated' status
    // for this specific round
    const participantsRef = collection(db, 'participants');
    const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    if (participantsSnapshot.empty) {
      return { success: false, error: 'No participants found' };
    }
    
    // Check if elimination has already been calculated for this round
    let alreadyProcessed = false;
    participantsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      // If any participant has qualified/eliminated status AND their currentRound matches,
      // the round has already been processed
      if ((data.status === 'qualified' || data.status === 'eliminated') && 
          data.currentRound === roundNumber) {
        alreadyProcessed = true;
      }
    });
    
    if (alreadyProcessed) {
      console.log(`[AutoEnd] Round ${roundNumber} already processed, skipping...`);
      return { success: true, alreadyProcessed: true };
    }
    
    // Get room configuration
    const config = await getRoomConfig(roomId);
    if (!config) {
      return { success: false, error: 'Room config not found' };
    }
    
    const roundConfig = config.rounds[`r${roundNumber}`];
    if (!roundConfig) {
      return { success: false, error: `Round ${roundNumber} config not found` };
    }
    
    const qualifyCount = roundConfig.qualifyCount;
    console.log(`[AutoEnd] Qualify count for round ${roundNumber}: ${qualifyCount}`);
    
    // Get all results for this round
    const resultsRef = collection(db, 'results');
    let results = [];
    
    try {
      const q = query(
        resultsRef,
        where('roomId', '==', roomId),
        where('round', '==', roundNumber),
        orderBy('finalScore', 'desc')
      );
      const resultsSnapshot = await getDocs(q);
      
      resultsSnapshot.forEach(docSnap => {
        results.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
    } catch (indexError) {
      if (indexError.code === 'failed-precondition') {
        // Fallback: fetch without orderBy and sort in memory
        const q = query(
          resultsRef,
          where('roomId', '==', roomId),
          where('round', '==', roundNumber)
        );
        const resultsSnapshot = await getDocs(q);
        
        resultsSnapshot.forEach(docSnap => {
          results.push({
            id: docSnap.id,
            ...docSnap.data()
          });
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
      } else {
        throw indexError;
      }
    }
    
    console.log(`[AutoEnd] Found ${results.length} results for round ${roundNumber}`);
    
    if (results.length === 0) {
      return { success: false, error: 'No results found yet' };
    }
    
    // Determine who qualifies (top N by finalScore)
    const qualifiedUserIds = results.slice(0, qualifyCount).map(r => r.userId);
    console.log(`[AutoEnd] Qualified users: ${qualifiedUserIds.join(', ')}`);
    
    // Update participant statuses
    const batch = writeBatch(db);
    let qualifiedCount = 0;
    let eliminatedCount = 0;
    
    participantsSnapshot.forEach(docSnap => {
      const participantUserId = docSnap.id;
      
      // Only update participants who have submitted results
      const hasResult = results.some(r => r.userId === participantUserId);
      
      if (hasResult) {
        if (qualifiedUserIds.includes(participantUserId)) {
          batch.update(docSnap.ref, {
            status: 'qualified',
            currentRound: roundNumber
          });
          qualifiedCount++;
        } else {
          batch.update(docSnap.ref, {
            status: 'eliminated',
            currentRound: roundNumber
          });
          eliminatedCount++;
        }
      }
    });
    
    console.log(`[AutoEnd] Updating ${qualifiedCount} qualified, ${eliminatedCount} eliminated`);
    await batch.commit();
    
    // Update room status to 'waiting' for next round (or 'completed' if round 3)
    const roomRef = doc(db, 'rooms', roomId);
    
    if (roundNumber === 3) {
      await updateDoc(roomRef, {
        roundStatus: 'completed',
        currentRound: 3,
        roundEndedAt: serverTimestamp()
      });
    } else {
      await updateDoc(roomRef, {
        roundStatus: 'waiting',
        currentRound: roundNumber,
        roundEndedAt: serverTimestamp()
      });
    }
    
    console.log(`[AutoEnd] Round ${roundNumber} auto-ended successfully`);
    
    return {
      success: true,
      qualified: qualifiedCount,
      eliminated: eliminatedCount
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
