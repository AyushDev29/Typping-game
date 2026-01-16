# Firebase Setup Guide

## Step-by-Step Firebase Configuration

### 1. Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Enter project name (e.g., "blind-typing-competition")
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication

1. In Firebase Console, click "Authentication" in left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Click on "Email/Password"
5. Enable "Email/Password" (toggle ON)
6. Click "Save"

### 3. Create Firestore Database

1. Click "Firestore Database" in left sidebar
2. Click "Create database"
3. Select "Start in production mode"
4. Choose a location (select closest to your users)
5. Click "Enable"

### 4. Set Firestore Security Rules

1. In Firestore Database, go to "Rules" tab
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admins collection
    match /admins/{adminId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    
    // Rooms
    match /rooms/{roomId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        resource.data.createdBy == request.auth.uid;
      allow delete: if false;
    }
    
    // Room config
    match /roomConfig/{roomId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Participants
    match /participants/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth.uid == userId || request.auth != null;
      allow delete: if false;
    }
    
    // Results
    match /results/{resultId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if false;
      allow delete: if false;
    }
  }
}
```

3. Click "Publish"

### 5. Create Indexes (Optional but Recommended)

Firestore may prompt you to create indexes. If you see errors about missing indexes:

1. Click the link in the error message
2. Click "Create index" in the Firebase Console
3. Wait for index to build (usually takes a few minutes)

### 6. Get Firebase Configuration

1. Click the gear icon ⚙️ next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. If no web app exists, click the web icon `</>`
5. Register app with nickname (e.g., "Blind Typing App")
6. Copy the `firebaseConfig` object

### 7. Update Application Config

1. Open `public/js/firebase.js`
2. Replace the placeholder config:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",           // Your actual API key
  authDomain: "...",            // Your actual auth domain
  projectId: "...",              // Your actual project ID
  storageBucket: "...",          // Your actual storage bucket
  messagingSenderId: "...",     // Your actual sender ID
  appId: "1:..."                // Your actual app ID
};
```

### 8. Create Admin User

#### Method 1: Through Firebase Console

1. Go to Authentication → Users
2. Click "Add user"
3. Enter admin email and password
4. Click "Add user"
5. Note the email address

#### Method 2: Through Application

1. Run the application
2. Go to login page
3. Click "Register here"
4. Enter admin email and password
5. Register account

#### Add to Admins Collection

1. Go to Firestore Database
2. Click "Start collection"
3. Collection ID: `admins`
4. Document ID: Click "Auto-ID" or enter custom ID
5. Add field:
   - Field: `email`
   - Type: `string`
   - Value: Your admin email (e.g., "admin@example.com")
6. Click "Save"

### 9. Test the Setup

1. Open the application
2. Login with admin credentials
3. You should be redirected to Admin Dashboard
4. Try creating a room

### 10. Create Test Participant (Optional)

1. Register a new user with different email
2. This user should be redirected to "Join Room" page
3. Use room code from admin to join

## Common Issues

### "Permission denied" errors

- Check Firestore security rules are published
- Verify user is authenticated
- Check rules syntax is correct

### Admin not recognized

- Verify email in `admins` collection matches exactly
- Check for typos (case-sensitive)
- Try logging out and back in

### "Room not found"

- Verify room code is correct
- Check room exists in Firestore `rooms` collection
- Ensure room code is uppercase

### Authentication not working

- Verify Email/Password provider is enabled
- Check Firebase config is correct
- Clear browser cache and cookies

## Database Structure Reference

After setup, your Firestore should have these collections:

```
admins/
  └── {adminId}
        email: "admin@example.com"

rooms/
  └── {roomId}
        roomCode: "ABC123"
        roomName: "Competition 1"
        currentRound: 0
        roundStatus: "waiting"
        createdBy: "{userId}"

roomConfig/
  └── {roomId}
        rounds: {
          r1: { paragraph: "...", time: 60, qualifyCount: 20 },
          r2: { paragraph: "...", time: 60, qualifyCount: 3 },
          r3: { paragraph: "...", time: 60, qualifyCount: 1 }
        }

participants/
  └── {userId}
        name: "John Doe"
        roomId: "{roomId}"
        status: "waiting"
        currentRound: 0

results/
  └── {resultId}
        userId: "{userId}"
        roomId: "{roomId}"
        round: 1
        wpm: 45.5
        accuracy: 95.2
        finalScore: 43.3
```

## Next Steps

1. Test admin flow: Create room, start rounds
2. Test participant flow: Join room, type, view results
3. Verify eliminations work correctly
4. Check leaderboard updates in real-time

---

**Note:** For production use, consider:
- Adding Cloud Functions for additional server-side validation
- Implementing rate limiting
- Adding error logging
- Setting up monitoring

