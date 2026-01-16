# Architecture & Implementation Guide

This document explains the architecture and key implementation details of the Blind Typing Competition application.

## 🏗️ Architecture Overview

### Frontend Architecture
- **Pure Vanilla JavaScript**: No frameworks, just ES6+ JavaScript
- **Modular Design**: Separate JS files for different concerns
- **Real-time Updates**: Firestore listeners for live data
- **Session Management**: Uses sessionStorage for user state

### Backend Architecture
- **Firebase Authentication**: User authentication
- **Firestore Database**: Real-time database for all data
- **Server-side Logic**: Elimination and scoring calculations

## 📂 File Structure & Responsibilities

### JavaScript Modules

#### `firebase.js`
- **Purpose**: Initialize Firebase services
- **Exports**: `auth`, `db` (global variables)
- **Key Logic**: 
  - Loads Firebase SDK
  - Initializes Auth and Firestore
  - Makes services globally available

#### `auth.js`
- **Purpose**: Handle authentication and role detection
- **Key Functions**:
  - `loginUser(email, password)`: Authenticates user and checks admin status
  - `logoutUser()`: Signs out and clears session
  - `getCurrentUser()`: Retrieves user from sessionStorage
  - `redirectByRole(user)`: Routes user based on role

**Role Detection Logic:**
```javascript
// After login, query admins collection
const adminDoc = await db.collection('admins')
  .where('email', '==', email)
  .get();

// If document exists, user is admin
const isAdmin = !adminDoc.empty;
```

#### `room.js`
- **Purpose**: Room management and participant handling
- **Key Functions**:
  - `createRoom(config)`: Creates room with unique code
  - `joinRoom(roomCode, userId, userName)`: Adds participant to room
  - `getRoomData(roomId)`: Fetches room information
  - `listenToRoom(roomId, callback)`: Real-time room updates
  - `listenToParticipants(roomId, callback)`: Real-time participant list

**Room Code Generation:**
```javascript
// Generates 6-character alphanumeric code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
```

#### `typing.js`
- **Purpose**: Implement blind typing functionality
- **Key Features**:
  - No visible input fields
  - Captures keydown events
  - Stores typed text in memory
  - Disables copy/paste/selection

**Blind Typing Implementation:**
```javascript
// Capture typing via keydown events
document.addEventListener('keydown', handleKeyDown);

function handleKeyDown(event) {
  // Prevent copy/paste shortcuts
  if (event.ctrlKey || event.metaKey) {
    if (['c', 'v', 'a', 'x'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      return;
    }
  }
  
  // Build typed string in memory (not displayed)
  if (event.key === 'Backspace') {
    typedText = typedText.slice(0, -1);
  } else if (event.key.length === 1) {
    typedText += event.key;
  }
}
```

**Security Measures:**
- Disables right-click context menu
- Blocks copy/paste events
- Prevents text selection
- Disables drag and drop

#### `scoring.js`
- **Purpose**: Calculate typing metrics
- **Key Function**: `calculateScore(originalText, typedText, timeInSeconds)`

**Scoring Formula:**
```javascript
// 1. Count correct characters
for (let i = 0; i < minLength; i++) {
  if (original[i] === typed[i]) {
    correctChars++;
  }
}

// 2. Calculate Accuracy
accuracy = (correctChars / totalChars) × 100

// 3. Calculate WPM (Words Per Minute)
// Standard: 5 characters = 1 word
wpm = (correctChars / 5) / (timeInSeconds / 60)

// 4. Calculate Final Score
finalScore = wpm × (accuracy / 100)
```

#### `admin.js`
- **Purpose**: Admin-specific operations
- **Key Functions**:
  - `startRound(roomId, roundNumber)`: Activates a round
  - `endRound(roomId, roundNumber)`: Calculates eliminations
  - `submitTypingResult(...)`: Stores participant results
  - `getLeaderboard(roomId, roundNumber)`: Fetches sorted results

**Elimination Logic:**
```javascript
// 1. Get all results for the round, sorted by finalScore
const results = await db.collection('results')
  .where('roomId', '==', roomId)
  .where('round', '==', roundNumber)
  .orderBy('finalScore', 'desc')
  .get();

// 2. Get top N participants (qualifyCount)
const qualifiedUserIds = results
  .slice(0, qualifyCount)
  .map(r => r.userId);

// 3. Update participant statuses
participants.forEach(participant => {
  if (qualifiedUserIds.includes(participant.id)) {
    status = 'qualified';
  } else {
    status = 'eliminated';
  }
});
```

## 🔄 Application Flow

### Admin Flow

1. **Login** → `login.html`
   - Authenticates with Firebase
   - Checks `admins` collection
   - Redirects to `admin/dashboard.html`

2. **Create Room** → `admin/create-room.html`
   - Enters room name
   - Configures 3 rounds (paragraph, time, qualify count)
   - Creates room in Firestore
   - Gets unique room code

3. **Manage Room** → `admin/room-control.html`
   - Views participants (real-time)
   - Starts Round 1 → Updates room status to 'active'
   - Ends Round 1 → Calculates eliminations
   - Repeats for Rounds 2 and 3
   - Views leaderboard

### Participant Flow

1. **Login** → `login.html`
   - Authenticates with Firebase
   - Not in admins collection
   - Redirects to `join-room.html`

2. **Join Room** → `join-room.html`
   - Enters name and room code
   - Added to `participants` collection
   - Redirects to `typing.html`

3. **Wait for Round** → `typing.html`
   - Listens to room status
   - Shows waiting screen
   - When status = 'active', shows typing screen

4. **Type** → `typing.html`
   - Paragraph displayed
   - Timer starts
   - Blind typing active (no visible input)
   - Auto-submits on timeout

5. **View Results** → `typing.html`
   - Shows accuracy, WPM, final score
   - Checks participant status
   - If qualified → wait for next round
   - If eliminated → redirect to `eliminated.html`

6. **Leaderboard** → `leaderboard.html`
   - View results for any round
   - Real-time updates

## 🗄️ Database Schema

### Collections

#### `admins`
```
{
  email: "admin@example.com"
}
```

#### `rooms`
```
{
  roomCode: "ABC123",
  roomName: "Competition 1",
  currentRound: 1,
  roundStatus: "active",  // waiting, active, completed
  createdBy: "userId",
  createdAt: Timestamp
}
```

#### `roomConfig`
```
{
  rounds: {
    r1: {
      paragraph: "The quick brown fox...",
      time: 60,
      qualifyCount: 20
    },
    r2: { ... },
    r3: { ... }
  }
}
```

#### `participants`
```
{
  name: "John Doe",
  roomId: "roomId",
  status: "active",  // waiting, active, qualified, eliminated
  currentRound: 1,
  joinedAt: Timestamp
}
```

#### `results`
```
{
  userId: "userId",
  roomId: "roomId",
  round: 1,
  wpm: 45.5,
  accuracy: 95.2,
  finalScore: 43.3,
  correctChars: 100,
  totalChars: 105,
  timeInSeconds: 60,
  submittedAt: Timestamp
}
```

## 🔐 Security Considerations

### Client-Side Security
- Input validation
- XSS prevention (Firebase handles this)
- Session management

### Server-Side Security (Firestore Rules)
- Authentication required for all operations
- Admin-only room updates
- Immutable results (no updates/deletes)
- Read-only admins collection

### Blind Typing Security
- No visible input prevents visual cheating
- Copy/paste disabled
- Text selection disabled
- Right-click disabled

## ⚡ Real-time Updates

### Firestore Listeners

**Room Status:**
```javascript
db.collection('rooms').doc(roomId).onSnapshot((doc) => {
  // Room data changed
  // Update UI accordingly
});
```

**Participants:**
```javascript
db.collection('participants')
  .where('roomId', '==', roomId)
  .onSnapshot((snapshot) => {
    // Participant list changed
    // Update participant list UI
  });
```

**Leaderboard:**
```javascript
db.collection('results')
  .where('roomId', '==', roomId)
  .where('round', '==', roundNumber)
  .orderBy('finalScore', 'desc')
  .onSnapshot((snapshot) => {
    // Results changed
    // Update leaderboard
  });
```

## 🎯 Key Design Decisions

### Why Vanilla JavaScript?
- No build step required
- Easy to understand for students
- Direct DOM manipulation
- No framework dependencies

### Why Session Storage?
- Persists during browser session
- Clears on tab close
- Simple state management
- No server-side sessions needed

### Why Firestore Listeners?
- Real-time updates without polling
- Automatic synchronization
- Efficient (only sends changes)
- Built-in offline support

### Why Server-Side Elimination?
- Prevents client-side manipulation
- Ensures data consistency
- Single source of truth
- Secure calculation

## 🐛 Common Issues & Solutions

### Issue: "Permission denied"
**Solution**: Check Firestore security rules are published

### Issue: Admin not recognized
**Solution**: Verify email in `admins` collection matches exactly

### Issue: Typing not captured
**Solution**: Check browser console, ensure JavaScript enabled

### Issue: Timer not working
**Solution**: Verify `timeRemaining` is set correctly, check interval

### Issue: Results not showing
**Solution**: Check Firestore indexes, verify query parameters

## 📚 Learning Points

1. **Modular JavaScript**: Separation of concerns
2. **Event-Driven Architecture**: Listeners and callbacks
3. **Real-time Data**: Firestore listeners
4. **State Management**: Session storage
5. **Security**: Client and server-side validation
6. **User Experience**: Loading states, error handling
7. **Responsive Design**: Mobile-friendly CSS

## 🔄 Future Enhancements

Possible improvements:
- Cloud Functions for server-side validation
- Email notifications
- Room history/archives
- Advanced statistics
- Multi-language support
- Custom themes
- Practice mode

---

This architecture provides a solid foundation for understanding full-stack web development with Firebase.

