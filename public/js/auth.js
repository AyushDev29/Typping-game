/**
 * Authentication Module
 * 
 * Handles user login, logout, and role detection
 * Role is determined by checking if email exists in 'admins' collection
 * 
 * Version: 2.0 - User document creation enabled
 */

// Version identifier for cache verification
console.log('Auth module loaded - Version: 2.0 - User document creation enabled');

import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Login function - FIXED VERSION
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - User object with role information
 */
export async function loginUser(email, password) {
  try {
    // Validate inputs
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password are required'
      };
    }
    
    if (typeof email !== 'string' || typeof password !== 'string') {
      return {
        success: false,
        error: 'Invalid input type'
      };
    }
    
    email = email.trim().toLowerCase();
    
    if (email.length === 0 || password.length < 6) {
      return {
        success: false,
        error: 'Invalid email or password'
      };
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: 'Invalid email format'
      };
    }
    
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // CRITICAL: Check admins collection FIRST (before checking users collection)
    const adminsRef = collection(db, 'admins');
    const adminQuery = query(adminsRef, where('email', '==', email));
    const adminSnapshot = await getDocs(adminQuery);
    const isAdminFromAdmins = !adminSnapshot.empty;
    
    // Get or create user document in Firestore
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    let role = 'participant'; // Default role
    let loginCount = 1;
    let userName = user.email.split('@')[0];
    let createdAt = serverTimestamp();
    
    if (userDoc.exists()) {
      // User document EXISTS - get existing data
      const userData = userDoc.data();
      role = userData.role || 'participant';
      loginCount = (userData.loginCount || 0) + 1; // Increment login count
      userName = userData.name || user.email.split('@')[0];
      createdAt = userData.createdAt || serverTimestamp();
      
      // If role is participant but email is in admins collection, upgrade to admin
      if (role === 'participant' && isAdminFromAdmins) {
        role = 'admin';
      }
    } else {
      // User document DOES NOT EXIST - CREATE IT NOW
      // Determine role: check admins collection first
      if (isAdminFromAdmins) {
        role = 'admin';
      }
    }
    
    // ALWAYS create/update user document
    try {
      if (userDoc.exists()) {
        // Document exists - update with merge
        await setDoc(userRef, {
          lastLoginAt: serverTimestamp(),
          loginCount: loginCount,
          role: role,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        // Document doesn't exist - create new document (NO MERGE)
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          name: userName,
          role: role,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          loginCount: loginCount,
          status: 'active',
          updatedAt: serverTimestamp()
        });
      }
    } catch (firestoreError) {
      console.error('Firestore write error:', firestoreError);
      // If permission error, throw it so user sees the issue
      if (firestoreError.code === 'permission-denied') {
        throw new Error('Permission denied. Please check Firestore rules are published.');
      }
      throw firestoreError;
    }
    
    // Verify document was created/updated
    const updatedUserDoc = await getDoc(userRef);
    if (!updatedUserDoc.exists()) {
      throw new Error('Failed to create user document in Firestore');
    }
    const finalUserData = updatedUserDoc.data();
    
    // Store user info in sessionStorage
    const userInfo = {
      uid: user.uid,
      email: user.email,
      name: finalUserData?.name || user.email.split('@')[0],
      role: finalUserData?.role || role
    };
    
    sessionStorage.setItem('user', JSON.stringify(userInfo));
    
    return {
      success: true,
      user: userInfo
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Register new user - FIXED VERSION
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} name - User name (optional)
 * @returns {Promise<Object>} - Result
 */
export async function registerUser(email, password, name = '') {
  try {
    // Validate inputs
    if (!email || !password) {
      return {
        success: false,
        error: 'Email and password are required'
      };
    }
    
    if (typeof email !== 'string' || typeof password !== 'string') {
      return {
        success: false,
        error: 'Invalid input type'
      };
    }
    
    email = email.trim().toLowerCase();
    name = (name || '').trim();
    
    if (email.length === 0 || password.length < 6) {
      return {
        success: false,
        error: 'Password must be at least 6 characters'
      };
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: 'Invalid email format'
      };
    }
    
    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Check if user is admin by checking admins collection
    const adminsRef = collection(db, 'admins');
    const q = query(adminsRef, where('email', '==', email));
    const adminDoc = await getDocs(q);
    const isAdmin = !adminDoc.empty;
    const role = isAdmin ? 'admin' : 'participant';
    
    // ALWAYS create user document in Firestore
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: email,
      name: name || email.split('@')[0],
      role: role,
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      loginCount: 1,
      status: 'active',
      updatedAt: serverTimestamp()
    });
    
    // Store user info in sessionStorage
    const userInfo = {
      uid: user.uid,
      email: user.email,
      name: name || email.split('@')[0],
      role: role
    };
    
    sessionStorage.setItem('user', JSON.stringify(userInfo));
    
    return {
      success: true,
      user: userInfo
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Logout function - Signs out user completely
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

/**
 * Exit game function - Leaves room but stays logged in
 * Use this when user wants to leave competition but not log out
 */
export function exitGame() {
  // Clear room-related session storage only
  sessionStorage.removeItem('roomId');
  sessionStorage.removeItem('roomCode');
  
  // Clear localStorage submission data
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
  
  // Redirect to join room page (user stays logged in)
  window.location.href = 'join-room.html';
}

/**
 * Get current user from sessionStorage
 * @returns {Object|null} - User object or null
 */
export function getCurrentUser() {
  const userStr = sessionStorage.getItem('user');
  if (userStr) {
    return JSON.parse(userStr);
  }
  return null;
}

/**
 * Get user data from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - User data or null
 */
export async function getUserData(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      return {
        id: userDoc.id,
        ...userDoc.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Get user data error:', error);
    return null;
  }
}

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Result
 */
export async function updateUserProfile(userId, updates) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Update user profile error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update user role (admin only)
 * @param {string} userId - User ID
 * @param {string} newRole - New role ('admin' or 'participant')
 * @returns {Promise<Object>} - Result
 */
export async function updateUserRole(userId, newRole) {
  try {
    if (newRole !== 'admin' && newRole !== 'participant') {
      return {
        success: false,
        error: 'Invalid role. Must be "admin" or "participant"'
      };
    }
    
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      role: newRole,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Update user role error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all users (admin only)
 * @returns {Promise<Array>} - Array of users
 */
export async function getAllUsers() {
  try {
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const users = [];
    usersSnapshot.forEach(docSnap => {
      users.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    
    return users;
  } catch (error) {
    console.error('Get all users error:', error);
    return [];
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  return getCurrentUser() !== null;
}

/**
 * Redirect based on role
 * @param {Object} user - User object with role
 */
export function redirectByRole(user) {
  if (user.role === 'admin') {
    window.location.href = 'admin/dashboard.html';
  } else {
    window.location.href = 'join-room.html';
  }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // User is signed out
    const currentPath = window.location.pathname;
    // Don't redirect if already on login page
    if (!currentPath.includes('login.html') && !currentPath.includes('index.html')) {
      // sessionStorage.clear();
      // window.location.href = 'login.html';
    }
  }
});

// Export auth for use in other modules if needed
export { auth };
