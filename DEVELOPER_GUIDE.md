# Developer Implementation Guide: Blind Typing Competition

This guide is designed to help a new developer understand the game structure, rules, and implementation details for the Blind Typing Competition application. It covers the specific rules for all 3 rounds and provides technical instructions for implementing the missing rounds.

## 📜 COMMON RULES (STRICT)

*Do not change any single word in this section.*

•	Each round carries 100 points.
•	The total score (out of 300) will decide the final winner.
•	Judges’ decisions regarding evaluation, scoring, and penalties will be final and binding.
•	Participants must write solutions clearly and neatly; code readability will be considered.
•	In case of a tie, the participant with the higher Round 3 score will be ranked higher.

________________________________________
🔹 **ROUND 1: BLIND TYPING (100 Points)**
•	Participants must type the given paragraph on a blank screen.
•	Accuracy and typing speed will both be considered for scoring.
•	The time limit will be fixed and announced before the round begins.
________________________________________
🔹 **ROUND 2: ERROR OUT (100 Points)**
•	Participants will be given code containing syntax errors and logical errors.
•	They must:
o	Identify the error
o	Write the corrected version of the code
•	The programming language will be specified before the round.
•	Marks depend on:
o	How accurately the mistake is identified
o	How correctly the error is fixed
•	Explanations are optional, unless specifically asked.
________________________________________
🔹 **ROUND 3: LOGIC BUILDING (100 Points)**
•	Participants will be given 2–3 logical problems.
•	They must write complete and working code for the given problems.
•	The specified programming language must be strictly followed.
•	Marks will be awarded based on:
o	Logical correctness
o	Code efficiency
o	Proper use of syntax
•	Code must be error-free and executable.
•	Proper indentation and readability will be considered during

---

## 🏗️ Project Structure & Architecture

The application uses **Vanilla JavaScript** with **Firebase (Firestore & Auth)**. No frontend frameworks are used.

### Key Directories
- **`public/`**: Root for the web app.
- **`public/js/`**: Contains modular JavaScript files.
- **`public/css/`**: Styling (CSS variables, responsive design).

### Key Files
- **`typing.html`**: The main game interface. It changes "Screens" (`.screen` divs) based on the game state.
- **`js/roomState.js`**: Manages the state flow (Waiting -> Active -> Result -> Leaderboard).
- **`js/typing.js`**: Handles the Blind Typing logic (events, no visual feedback).
- **`js/room.js`**: Handles fetching room configuration.

---

## 🚀 Implementation Guide for New Rounds

Currently, the app implements **Round 1 (Blind Typing)**. You need to implement the logic for **Round 2** and **Round 3** to match the rules above.

### Step 1: Update `typing.html` for New UI

You need to add new "Screen" containers for Rounds 2 and 3 within the `<div class="game-container">`.

```html
<!-- Add inside .game-container in typing.html -->

<!-- ROUND 2: ERROR OUT SCREEN -->
<div id="errorOutScreen" class="screen">
    <div class="typing-card">
        <div class="typing-header">
            <div class="round-badge">
                <div class="round-number">2</div>
                <h2>Error Out</h2>
            </div>
            <div class="timer-display"><span id="errorTimer">00:00</span></div>
        </div>
        <div class="paragraph-container" style="background: #1e1e1e; color: #d4d4d4; font-family: monospace;">
            <!-- Display buggy code here -->
            <pre id="buggyCodeDisplay"></pre> 
        </div>
        <div class="typing-footer">
            <textarea id="correctionInput" placeholder="Write corrected code here..." style="width:100%; height: 150px; background: #0f0f14; color: white; border: 1px solid #333; padding: 10px;"></textarea>
            <button id="submitCorrectionBtn" class="btn btn-primary" style="margin-top: 10px;">Submit Solution</button>
        </div>
    </div>
</div>

<!-- ROUND 3: LOGIC BUILDING SCREEN -->
<div id="logicBuildScreen" class="screen">
    <div class="typing-card">
        <div class="typing-header">
            <div class="round-badge">
                <div class="round-number">3</div>
                <h2>Logic Building</h2>
            </div>
            <div class="timer-display"><span id="logicTimer">00:00</span></div>
        </div>
        <div class="paragraph-container">
            <h3>Problem Statement:</h3>
            <p id="logicProblemDisplay"></p>
        </div>
        <div class="typing-footer">
             <textarea id="logicSolutionInput" placeholder="Write your full code solution here..." style="width:100%; height: 200px; background: #0f0f14; color: white; border: 1px solid #333; padding: 10px;"></textarea>
            <button id="submitLogicBtn" class="btn btn-primary" style="margin-top: 10px;">Submit Code</button>
        </div>
    </div>
</div>
```

### Step 2: Implement Logic Modules

Create two new files in `public/js/`:
1.  `errorRound.js`
2.  `logicRound.js`

#### `js/errorRound.js` Template
```javascript
export function initErrorRound(buggyCode, onComplete) {
    document.getElementById('buggyCodeDisplay').textContent = buggyCode;
    
    document.getElementById('submitCorrectionBtn').onclick = () => {
        const correction = document.getElementById('correctionInput').value;
        // Logic to calculate score or save for manual judging
        // For automated: Compare correction vs expected fixed code strictly?
        // For manual: Save correction to Firestore 'submissions' collection
        onComplete({ 
            answer: correction,
            score: 0 // Placeholder until judged
        });
    };
}
```

#### `js/logicRound.js` Template
```javascript
export function initLogicRound(problemStatement, onComplete) {
    document.getElementById('logicProblemDisplay').textContent = problemStatement;
    
    document.getElementById('submitLogicBtn').onclick = () => {
        const code = document.getElementById('logicSolutionInput').value;
        // Save to Firestore for manual judging as per rules
        onComplete({
            answer: code,
            score: 0 // Waiting for judge
        });
    };
}
```

### Step 3: Update Main Logic (`typing.html` Script)

Modify the `handleTyping` function in the main `<script type="module">` block of `typing.html` to switch logic based on `roundNumber`.

**Current Logic:**
```javascript
// Currently assumes Round 1
initBlindTyping(roundData.paragraph, (result) => { ... });
```

**Updated Logic:**
```javascript
import { initErrorRound } from './js/errorRound.js';
import { initLogicRound } from './js/logicRound.js';

// Inside handleTyping(roundNumber)
if (roundNumber === 1) {
    showScreen('typingScreen');
    initBlindTyping(roundData.paragraph, handleRound1Complete);
} else if (roundNumber === 2) {
    showScreen('errorOutScreen');
    // Ensure roomConfig has 'buggyCode' for r2
    initErrorRound(roundData.buggyCode, handleRoundComplete);
} else if (roundNumber === 3) {
    showScreen('logicBuildScreen');
    // Ensure roomConfig has 'problemStatement' for r3
    initLogicRound(roundData.problemStatement, handleRoundComplete);
}
```

### Step 4: Database & Admin Updates

1.  **Room Config**: Update the Admin panel (or manually update Firestore) to include the new fields in `roomConfig`:
    *   **Round 2**: Needs `buggyCode` string.
    *   **Round 3**: Needs `problemStatement` string.
2.  **Scoring**:
    *   Rounds 2 & 3 require *Judges' evaluation* according to the rules ("Judges’ decisions... will be final").
    *   **Implementation**: Instead of calculating `accuracy` / `wpm` immediately, save the user's submission to a `submissions` collection.
    *   **Admin Panel**: Build a "Judge View" where admins can read submitted code and enter a score (0-100).

---

## 💡 Routing Summary

The app uses `sessionStorage` and `roomState.js` to handle flow.

1.  **Entry**: `join-room.html` -> sets `roomId` in generic storage -> redirect `typing.html`.
2.  **Wait Loop**: `typing.html` queries `rooms/{roomId}` for `currentRound` and `roundStatus`.
3.  **Active Round**:
    *   If `status === 'active'`, specific Round UI is shown.
    *   Screen is chosen based on Round Number (1, 2, or 3).
4.  **Completion**: User submits -> Data saved to Firestore -> Redirect to `leaderboard.html` (or waiting screen).

Follow this guide to ensure the game remains modular and the rules are strictly enforced!
