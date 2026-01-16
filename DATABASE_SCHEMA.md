# Database Schema Documentation

## Firestore Collections

### 📁 `users` Collection
Stores all user account information and login history.

**Document ID:** `{userId}` (Firebase Auth UID)

**Fields:**
```javascript
{
  uid: string,              // Firebase Auth UID
  email: string,            // User email address
  name: string,             // User display name
  role: string,             // 'admin' or 'participant'
  createdAt: timestamp,     // Account creation date
  lastLoginAt: timestamp,   // Last login timestamp
  loginCount: number,       // Total number of logins
  status: string,           // 'active' or 'inactive'
  updatedAt: timestamp      // Last update timestamp
}
```

**Example:**
```
users/
  └── abc123xyz
        uid: "abc123xyz"
        email: "user@example.com"
        name: "John Doe"
        role: "participant"
        createdAt: Timestamp(2024-01-15 10:30:00)
        lastLoginAt: Timestamp(2024-01-20 14:25:00)
        loginCount: 15
        status: "active"
        updatedAt: Timestamp(2024-01-20 14:25:00)
```

### 📁 `admins` Collection
Stores admin email addresses for role detection.

**Document ID:** Auto-generated or custom

**Fields:**
```javascript
{
  email: string  // Admin email address
}
```

### 📁 `rooms` Collection
Stores competition room information.

**Document ID:** Auto-generated

**Fields:**
```javascript
{
  roomCode: string,         // 6-character unique code
  roomName: string,         // Room display name
  currentRound: number,     // Current round (0-3)
  roundStatus: string,      // 'waiting', 'active', 'completed'
  createdBy: string,        // Admin user ID
  createdAt: timestamp,      // Creation timestamp
  roundStartedAt: timestamp // When current round started
}
```

### 📁 `roomConfig` Collection
Stores room configuration (paragraphs, timers, qualification counts).

**Document ID:** `{roomId}` (matches rooms collection)

**Fields:**
```javascript
{
  rounds: {
    r1: {
      paragraph: string,     // Text to type
      time: number,         // Time in seconds
      qualifyCount: number   // How many qualify
    },
    r2: { ... },
    r3: { ... }
  }
}
```

**Document ID:** `{roomId}` (matches rooms collection)

**Fields:**
```javascript
{
  rounds: {
    r1: {
      paragraph: string,     // Text to type
      time: number,         // Time in seconds
      qualifyCount: number   // How many qualify
    },
    r2: { ... },
    r3: { ... }
  }
}
```

### 📁 `participants` Collection
Stores participant information for each room.

**Document ID:** `{userId}` (Firebase Auth UID)

**Fields:**
```javascript
{
  name: string,            // Participant display name
  roomId: string,          // Room they joined
  status: string,          // 'waiting', 'active', 'qualified', 'eliminated'
  currentRound: number,    // Current round number
  joinedAt: timestamp      // When they joined
}
```

### 📁 `results` Collection
Stores typing competition results.

**Document ID:** Auto-generated

**Fields:**
```javascript
{
  userId: string,          // Participant user ID
  roomId: string,          // Room ID
  round: number,           // Round number (1, 2, or 3)
  wpm: number,             // Words per minute
  accuracy: number,        // Accuracy percentage
  finalScore: number,      // Calculated final score
  correctChars: number,    // Number of correct characters
  totalChars: number,      // Total characters in paragraph
  timeInSeconds: number,   // Time taken
  submittedAt: timestamp   // Submission timestamp
}
```

## Data Flow

### User Registration
1. User registers → Firebase Auth creates account
2. `registerUser()` function:
   - Checks if email is in `admins` collection
   - Creates document in `users` collection
   - Stores: email, name, role, timestamps, loginCount

### User Login
1. User logs in → Firebase Auth authenticates
2. `loginUser()` function:
   - Checks admin status
   - Gets or creates `users` document
   - Updates: `lastLoginAt`, increments `loginCount`
   - Updates role if admin status changed

### Room Creation
1. Admin creates room → `createRoom()` function
2. Creates document in `rooms` collection
3. Creates document in `roomConfig` collection

### Participant Joining
1. Participant joins → `joinRoom()` function
2. Creates/updates document in `participants` collection
3. Links to room via `roomId`

### Result Submission
1. Participant finishes typing → `submitTypingResult()` function
2. Calculates scores
3. Creates document in `results` collection

## Security Rules

All collections have security rules defined in `FIRESTORE_RULES.txt`:
- Users can read/write their own data
- Admins can read all data
- Results are immutable after creation
- Participants can update their own status

## Indexes Required

1. **results** collection:
   - `roomId` (Ascending) + `round` (Ascending) + `finalScore` (Descending)

2. **rooms** collection:
   - `createdBy` (Ascending) + `createdAt` (Descending)

Firebase will prompt you to create these when needed.

