# 🎯 Blind Typing Competition - Single Round

A real-time blind typing competition web application built with Firebase. Participants compete in a single round where their keystrokes are hidden, testing their muscle memory and typing accuracy.

## 🌟 Features

### 🔥 Core Functionality
- **Single Round Competition**: Streamlined one-round format
- **Blind Typing**: Keystrokes are hidden during typing
- **Real-time Multiplayer**: Up to 100+ concurrent participants
- **MonkeyType-Style Scoring**: Net WPM, accuracy, and character-based calculations
- **Live Leaderboards**: Real-time updates during and after competition
- **Qualification System**: Configurable winner count with automatic qualification/elimination

### 👨‍💼 Admin Features
- **Room Management**: Create and control competition rooms
- **Live Monitoring**: Real-time participant tracking and statistics
- **Automatic Round Management**: Timer-based round ending
- **Result Analytics**: Comprehensive performance metrics

### 🏆 Participant Experience
- **Seamless Join Process**: Easy room joining with codes
- **Live Competition**: Real-time typing with hidden input
- **Instant Results**: Immediate score calculation and ranking
- **Qualification Status**: Clear messaging for Round 2 qualification

## 🚀 Live Demo

**🔗 Application**: [https://blind-typing-1.firebaseapp.com/](https://blind-typing-1.firebaseapp.com/)

## 📊 Scoring System (MonkeyType Style)

### Metrics Calculated:
- **Net WPM**: (Correct chars - Incorrect chars) / 5 / minutes *(Primary ranking metric)*
- **Raw WPM**: All typed characters / 5 / minutes
- **Accuracy**: Correct characters / Expected characters × 100%
- **Final Score**: Net WPM *(used for leaderboard ranking)*

### Ranking Priority:
1. **Net WPM** (Higher is better)
2. **Accuracy** (Higher is better) 
3. **Submission Time** (Earlier is better)

## 🎮 How to Use

### For Participants:
1. Visit the application URL
2. Enter your name and join a room with the room code
3. Wait for admin to start the round
4. Type the displayed paragraph (your input is hidden)
5. Submit when finished or when time expires
6. View results and qualification status

### For Admins:
1. Go to `/admin/dashboard.html`
2. Create a new room with desired settings
3. Configure winner count (how many qualify for Round 2)
4. Share room code with participants
5. Start the round when ready
6. Monitor progress and view live results

## 🏗️ Technical Architecture

### Frontend:
- **Vanilla JavaScript** (ES6 modules)
- **Firebase SDK** for real-time database
- **Responsive CSS** with modern design
- **Real-time listeners** for live updates

### Backend:
- **Firebase Firestore** for data storage
- **Firebase Authentication** for user management
- **Firebase Hosting** for deployment
- **Real-time synchronization** across all clients

### Key Collections:
- `rooms` - Competition room data and status
- `roomConfig` - Room settings and paragraph content
- `participants` - User data and qualification status
- `results` - Typing results and scores

## 🔧 Setup & Deployment

### Prerequisites:
- Node.js and npm
- Firebase CLI
- Git

### Local Development:
```bash
# Clone the repository
git clone https://github.com/AyushDev29/Typping-game.git
cd Typping-game

# Install Firebase CLI (if not installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Serve locally
firebase serve
```

### Deployment:
```bash
# Build and deploy
firebase deploy
```

## 📁 Project Structure

```
├── public/
│   ├── admin/           # Admin panel pages
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript modules
│   ├── index.html      # Landing page
│   ├── login.html      # Authentication
│   ├── join-room.html  # Room joining
│   ├── typing.html     # Main competition interface
│   ├── leaderboard.html # Results display
│   └── eliminated.html  # Completion/qualification page
├── firebase.json       # Firebase configuration
├── FIRESTORE_RULES.txt # Database security rules
└── README.md          # This file
```

## 🎯 Competition Flow

1. **Room Creation**: Admin creates room with settings
2. **Participant Joining**: Users join with room code
3. **Round Start**: Admin starts the single round
4. **Typing Phase**: Participants type blindly with timer
5. **Auto-End**: Round ends when timer expires
6. **Results Calculation**: Automatic scoring and ranking
7. **Qualification**: Users see if they qualified for Round 2
8. **Leaderboard**: Final results with qualification status

## 🔐 Security Features

- **Input validation** on all user submissions
- **Rate limiting** on database operations
- **Secure Firebase rules** for data access
- **XSS protection** with input sanitization
- **Authentication required** for admin functions

## 🎨 UI/UX Features

- **Dark theme** with modern glassmorphism design
- **Responsive layout** for all device sizes
- **Real-time animations** and smooth transitions
- **Accessibility compliant** with proper ARIA labels
- **Loading states** and error handling
- **Progressive enhancement** for better performance

## 📈 Performance Optimizations

- **Efficient Firebase queries** with proper indexing
- **Real-time listeners** with automatic cleanup
- **Minimal DOM manipulation** for smooth performance
- **Lazy loading** of non-critical resources
- **Optimized bundle size** with ES6 modules

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **MonkeyType** for scoring methodology inspiration
- **Firebase** for real-time infrastructure
- **Modern web standards** for responsive design

---

**🔗 Live Application**: [https://blind-typing-1.firebaseapp.com/](https://blind-typing-1.firebaseapp.com/)

**📧 Support**: For issues or questions, please open a GitHub issue.
