# Blind Typing Competition Game

A competitive multiplayer blind typing game with 3 elimination rounds. Built with Firebase and vanilla JavaScript.

## 🎮 Features

- **3-Round Elimination System**: Progressive elimination after each round
- **Real-time Multiplayer**: Support for 100+ concurrent users
- **Blind Typing**: Hidden input for fair competition
- **Word-by-Word Accuracy**: Strict accuracy calculation
- **Admin Dashboard**: Complete room and user management
- **Live Leaderboards**: Real-time rankings with proper sorting
- **Responsive Design**: Works on desktop and mobile

## 🚀 Live Demo

- **Firebase Hosting**: [https://blind-typing-1.web.app](https://blind-typing-1.web.app)

## 📋 Prerequisites

- Firebase account
- Node.js (for Firebase CLI)
- Git

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/AyushDev29/Typping-game.git
cd Typping-game
```

### 2. Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Authentication (Email/Password)
3. Enable Firestore Database
4. Enable Hosting

### 3. Configure Firebase

Update `public/js/firebase.js` with your Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 4. Set Up Firestore Rules

Copy the rules from `FIRESTORE_RULES.txt` to your Firestore Rules in Firebase Console.

### 5. Create Required Firestore Index

Create a composite index on the `results` collection:
- Collection: `results`
- Fields:
  - `roomId` (Ascending)
  - `round` (Ascending)
  - `accuracy` (Descending)

## 🚀 Deployment

### Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy --only hosting
```

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

3. Configure build settings in Vercel dashboard:
   - **Build Command**: Leave empty (static site)
   - **Output Directory**: `public`
   - **Install Command**: Leave empty

## 📁 Project Structure

```
├── public/
│   ├── admin/              # Admin dashboard pages
│   ├── css/                # Stylesheets
│   ├── js/                 # JavaScript modules
│   │   ├── firebase.js     # Firebase configuration
│   │   ├── auth.js         # Authentication logic
│   │   ├── room.js         # Room management
│   │   ├── roomState.js    # State machine
│   │   ├── scoring.js      # Scoring calculations
│   │   ├── admin.js        # Admin functions
│   │   └── typing.js       # Typing mechanics
│   ├── index.html          # Landing page
│   ├── login.html          # Login page
│   ├── join-room.html      # Join room page
│   ├── typing.html         # Main game page
│   ├── leaderboard.html    # Final leaderboard
│   └── eliminated.html     # Elimination page
├── firebase.json           # Firebase configuration
├── FIRESTORE_RULES.txt     # Firestore security rules
└── README.md               # This file
```

## 🎯 How to Play

### For Participants

1. **Register/Login**: Create an account or login
2. **Join Room**: Enter a 6-character room code
3. **Wait**: Wait for admin to start Round 1
4. **Type**: Type the paragraph as accurately as possible (input is hidden)
5. **View Results**: See your score and ranking
6. **Qualify or Eliminate**: Top performers advance to next round
7. **Repeat**: Continue through Rounds 2 and 3
8. **Winner**: Highest accuracy in Round 3 wins!

### For Admins

1. **Login**: Use admin credentials
2. **Create Room**: Set up 3 rounds with paragraphs and time limits
3. **Share Code**: Give room code to participants
4. **Start Rounds**: Start each round when ready
5. **Monitor**: View live statistics and leaderboards
6. **Manage**: Control room state and view results

## 🔧 Configuration

### Admin Setup

1. Go to Firestore Database
2. Create collection: `admins`
3. Add document with field:
   - `email`: "your-admin-email@example.com"
4. Login with that email to get admin access

### Room Configuration

Each round requires:
- **Paragraph**: Text to type
- **Time Limit**: Seconds (1-3600)
- **Qualify Count**: Number of users who advance

## 📊 Scoring System

### Accuracy Calculation (Word-by-Word)
- Each word must match EXACTLY
- Partial words = 0 credit
- Formula: `(Correct Words / Total Words) × 100`

### WPM Calculation
- Only correct characters from correct words count
- Formula: `(Correct Characters / 5) / Minutes`

### Leaderboard Sorting
1. **Accuracy** (highest first)
2. **WPM** (highest first)
3. **Completion Time** (earliest first)

## 🐛 Troubleshooting

### Index Error
If you see "The query requires an index":
1. Click the link in the error message
2. Create the index in Firebase Console
3. Wait 2-5 minutes for index to build

### Permission Denied
1. Check Firestore Rules are published
2. Verify rules match `FIRESTORE_RULES.txt`
3. Ensure user is authenticated

### Users Can't Join
- Room locks after Round 1 starts (by design)
- Only existing participants can rejoin
- Check room status in admin dashboard

## 🔒 Security

- Firestore security rules enforce access control
- Admin role checked server-side
- Participant data isolated by room
- No client-side role manipulation

## 📝 License

MIT License - feel free to use for your own projects!

## 👨‍💻 Author

**Ayush Dev**
- GitHub: [@AyushDev29](https://github.com/AyushDev29)

## 🙏 Acknowledgments

- Firebase for backend infrastructure
- Modern CSS for beautiful UI
- Community feedback for improvements

## 📞 Support

For issues or questions:
1. Check existing documentation files
2. Review Firebase Console for errors
3. Open an issue on GitHub

---

**Built with ❤️ for competitive typing enthusiasts**
