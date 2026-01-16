/**
 * Analytics Module
 * 
 * Provides comprehensive competition statistics and data for admin panel
 */

import { db } from './firebase.js';
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Get all competition statistics for a room
 * @param {string} roomId - Room ID
 * @returns {Promise<Object>} - Statistics object
 */
export async function getRoomStatistics(roomId) {
  try {
    // Get room data
    const roomRef = doc(db, 'rooms', roomId);
    const roomDoc = await getDoc(roomRef);
    
    if (!roomDoc.exists()) {
      return { error: 'Room not found' };
    }
    
    const roomData = roomDoc.data();
    
    // Get participants
    const participantsRef = collection(db, 'participants');
    const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    const participants = [];
    participantsSnapshot.forEach(doc => {
      participants.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Get all results for this room
    const resultsRef = collection(db, 'results');
    const resultsQuery = query(resultsRef, where('roomId', '==', roomId));
    const resultsSnapshot = await getDocs(resultsQuery);
    
    const results = [];
    const roundStats = {
      r1: { total: 0, avgWPM: 0, avgAccuracy: 0, avgScore: 0 },
      r2: { total: 0, avgWPM: 0, avgAccuracy: 0, avgScore: 0 },
      r3: { total: 0, avgWPM: 0, avgAccuracy: 0, avgScore: 0 }
    };
    
    resultsSnapshot.forEach(doc => {
      const result = doc.data();
      results.push({
        id: doc.id,
        ...result
      });
      
      const roundKey = `r${result.round}`;
      if (roundStats[roundKey]) {
        roundStats[roundKey].total++;
        roundStats[roundKey].avgWPM += result.wpm;
        roundStats[roundKey].avgAccuracy += result.accuracy;
        roundStats[roundKey].avgScore += result.finalScore;
      }
    });
    
    // Calculate averages
    Object.keys(roundStats).forEach(round => {
      if (roundStats[round].total > 0) {
        roundStats[round].avgWPM = roundStats[round].avgWPM / roundStats[round].total;
        roundStats[round].avgAccuracy = roundStats[round].avgAccuracy / roundStats[round].total;
        roundStats[round].avgScore = roundStats[round].avgScore / roundStats[round].total;
      }
    });
    
    // Count participants by status
    const statusCounts = {
      waiting: 0,
      active: 0,
      qualified: 0,
      eliminated: 0
    };
    
    participants.forEach(p => {
      if (statusCounts[p.status] !== undefined) {
        statusCounts[p.status]++;
      }
    });
    
    return {
      room: {
        id: roomId,
        ...roomData
      },
      participants: {
        total: participants.length,
        byStatus: statusCounts,
        list: participants
      },
      results: {
        total: results.length,
        byRound: roundStats,
        all: results
      }
    };
  } catch (error) {
    console.error('Get room statistics error:', error);
    return { error: error.message };
  }
}

/**
 * Get all rooms with statistics
 * @returns {Promise<Array>} - Array of rooms with stats
 */
export async function getAllRoomsWithStats() {
  try {
    const roomsRef = collection(db, 'rooms');
    const roomsSnapshot = await getDocs(roomsRef);
    
    const rooms = [];
    
    for (const doc of roomsSnapshot.docs) {
      const roomData = doc.data();
      const roomId = doc.id;
      
      // Get participant count
      const participantsRef = collection(db, 'participants');
      const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
      const participantsSnapshot = await getDocs(participantsQuery);
      
      // Get result count
      const resultsRef = collection(db, 'results');
      const resultsQuery = query(resultsRef, where('roomId', '==', roomId));
      const resultsSnapshot = await getDocs(resultsQuery);
      
      rooms.push({
        id: roomId,
        ...roomData,
        participantCount: participantsSnapshot.size,
        resultCount: resultsSnapshot.size
      });
    }
    
    return rooms;
  } catch (error) {
    console.error('Get all rooms with stats error:', error);
    return [];
  }
}

/**
 * Get overall competition statistics
 * @returns {Promise<Object>} - Overall statistics
 */
export async function getOverallStatistics() {
  try {
    // Get all users
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    const totalUsers = usersSnapshot.size;
    
    // Get all rooms
    const roomsRef = collection(db, 'rooms');
    const roomsSnapshot = await getDocs(roomsRef);
    const totalRooms = roomsSnapshot.size;
    
    // Get all participants
    const participantsRef = collection(db, 'participants');
    const participantsSnapshot = await getDocs(participantsRef);
    const totalParticipants = participantsSnapshot.size;
    
    // Get all results
    const resultsRef = collection(db, 'results');
    const resultsSnapshot = await getDocs(resultsRef);
    const totalResults = resultsSnapshot.size;
    
    // Calculate average scores
    let totalWPM = 0;
    let totalAccuracy = 0;
    let totalScore = 0;
    
    resultsSnapshot.forEach(doc => {
      const result = doc.data();
      totalWPM += result.wpm;
      totalAccuracy += result.accuracy;
      totalScore += result.finalScore;
    });
    
    const avgWPM = totalResults > 0 ? totalWPM / totalResults : 0;
    const avgAccuracy = totalResults > 0 ? totalAccuracy / totalResults : 0;
    const avgScore = totalResults > 0 ? totalScore / totalResults : 0;
    
    // Get top performers
    const topResultsQuery = query(
      resultsRef,
      orderBy('finalScore', 'desc'),
      limit(10)
    );
    const topResultsSnapshot = await getDocs(topResultsQuery);
    
    const topPerformers = [];
    topResultsSnapshot.forEach(doc => {
      topPerformers.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return {
      users: {
        total: totalUsers
      },
      rooms: {
        total: totalRooms
      },
      participants: {
        total: totalParticipants
      },
      results: {
        total: totalResults,
        averageWPM: avgWPM,
        averageAccuracy: avgAccuracy,
        averageScore: avgScore
      },
      topPerformers: topPerformers
    };
  } catch (error) {
    console.error('Get overall statistics error:', error);
    return { error: error.message };
  }
}

/**
 * Get complete leaderboard for all rounds in a room
 * @param {string} roomId - Room ID
 * @returns {Promise<Object>} - Complete leaderboard
 */
export async function getCompleteLeaderboard(roomId) {
  try {
    const leaderboard = {
      r1: [],
      r2: [],
      r3: []
    };
    
    // Get participants for names
    const participantsRef = collection(db, 'participants');
    const participantsQuery = query(participantsRef, where('roomId', '==', roomId));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    const participantsMap = {};
    participantsSnapshot.forEach(doc => {
      participantsMap[doc.id] = doc.data().name;
    });
    
    // Get results for each round
    for (let round = 1; round <= 3; round++) {
      const resultsRef = collection(db, 'results');
      const resultsQuery = query(
        resultsRef,
        where('roomId', '==', roomId),
        where('round', '==', round),
        orderBy('finalScore', 'desc')
      );
      
      const resultsSnapshot = await getDocs(resultsQuery);
      
      resultsSnapshot.forEach(doc => {
        const result = doc.data();
        leaderboard[`r${round}`].push({
          id: doc.id,
          ...result,
          name: participantsMap[result.userId] || 'Unknown'
        });
      });
    }
    
    return leaderboard;
  } catch (error) {
    console.error('Get complete leaderboard error:', error);
    return { error: error.message };
  }
}


