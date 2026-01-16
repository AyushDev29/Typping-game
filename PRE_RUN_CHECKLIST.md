# Pre-Run Checklist ✅

Before running the application, complete these steps:

## 🔥 Firebase Setup (REQUIRED)

### 1. ✅ Firestore Security Rules
- [ ] Go to Firebase Console → Firestore Database → Rules
- [ ] Copy rules from `FIRESTORE_RULES.txt`
- [ ] Paste and click "Publish"

### 2. ✅ Create Admin User in Firestore
- [ ] Go to Firestore Database
- [ ] Click "Start collection"
- [ ] Collection ID: `admins`
- [ ] Document ID: Click "Auto-ID" (or custom)
- [ ] Add field:
  - Field name: `email`
  - Type: `string`
  - Value: Your admin email (e.g., "admin@example.com")
- [ ] Click "Save"

### 3. ✅ Create Firestore Indexes (REQUIRED)

Firestore will need composite indexes for these queries. You can create them manually or let Firebase create them automatically when you first run the queries.

#### Index 1: Results Leaderboard
- Collection: `results`
- Fields indexed:
  - `roomId` (Ascending)
  - `round` (Ascending)
  - `finalScore` (Descending)

#### Index 2: Admin Rooms List
- Collection: `rooms`
- Fields indexed:
  - `createdBy` (Ascending)
  - `createdAt` (Descending)

**How to create indexes:**
1. When you run the app and see an error about missing index, click the link in the error
2. OR go to Firebase Console → Firestore Database → Indexes
3. Click "Create Index"
4. Fill in the fields above
5. Click "Create"

### 4. ✅ Enable Authentication
- [ ] Go to Firebase Console → Authentication
- [ ] Click "Get started" (if not already enabled)
- [ ] Go to "Sign-in method" tab
- [ ] Enable "Email/Password" provider
- [ ] Click "Save"

## 🚀 Running the Application

### Option 1: Local Server (Recommended for Testing)

**Using Python:**
```bash
cd public
python -m http.server 8000
```
Then open: http://localhost:8000

**Using Node.js (http-server):**
```bash
npm install -g http-server
cd public
http-server -p 8000
```

**Using VS Code:**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

### Option 2: Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize (if not done)
firebase init hosting
# Select: public directory, single-page app: No

# Deploy
firebase deploy --only hosting
```

## 🧪 Testing Checklist

### Admin Flow
- [ ] Login with admin email
- [ ] Should redirect to Admin Dashboard
- [ ] Create a new room
- [ ] Configure all 3 rounds
- [ ] Get room code
- [ ] View participants list
- [ ] Start Round 1
- [ ] End Round 1 (check eliminations)
- [ ] View leaderboard

### Participant Flow
- [ ] Register/Login with non-admin email
- [ ] Should redirect to Join Room page
- [ ] Enter name and room code
- [ ] Join room successfully
- [ ] Wait for round to start
- [ ] Type when round starts (blind typing)
- [ ] View results after submission
- [ ] Check if qualified/eliminated

## ⚠️ Common First-Run Issues

### "Missing or insufficient permissions"
- **Fix**: Check Firestore security rules are published

### "The query requires an index"
- **Fix**: Click the link in the error to create the index automatically

### "Admin not recognized"
- **Fix**: Verify email in `admins` collection matches exactly (case-sensitive)

### "Cannot read properties of undefined"
- **Fix**: Check browser console, ensure all modules are loading correctly

### "Failed to fetch"
- **Fix**: Check Firebase config in `public/js/firebase.js` is correct

## 📝 Quick Start Commands

```bash
# Navigate to project
cd "C:\Users\Ayush\OneDrive\Desktop\task2\blind tipping app"

# Start local server (Python)
cd public
python -m http.server 8000

# Or using Node.js
npx http-server public -p 8000
```

## ✅ Ready to Run?

Once you've completed:
- ✅ Firestore rules published
- ✅ Admin user created in Firestore
- ✅ Authentication enabled
- ✅ Local server running

**You're ready to go!** 🎉

Open your browser and navigate to:
- `http://localhost:8000` (or your server port)

---

**Note**: The first time you run queries that need indexes, Firebase will show an error with a link to create them. Click the link and the index will be created automatically.

