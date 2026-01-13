/* ================= 0. IMPORTS ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= 1. CONFIGURATION ================= */

const firebaseConfig = {
  apiKey: "AIzaSyApsaSQxvFE8vVfInxIeTBCmUF0lN486Bw",
  authDomain: "latex-game-e7567.firebaseapp.com",
  databaseURL: "https://latex-game-e7567-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "latex-game-e7567",
  storageBucket: "latex-game-e7567.firebasestorage.app",
  messagingSenderId: "706625069538",
  appId: "1:706625069538:web:6a0d0477f3446b0be399bb"
};


// Initialize Database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= 2. GAME STATE & GLOBALS ================= */
let currentProblemIndex = 0; 
let problems = [];           
let score = 0;
let problemsSolved = 0;
let timerInterval;
let timeLeft = 180; 

// UI Elements
const inputField = document.getElementById('code-input');
const previewBox = document.getElementById('preview-box');
const targetBox = document.getElementById('target-box');

/* ================= 3. DATABASE LOGIC (FIREBASE) ================= */

function subscribeToProblems() {
    const q = query(collection(db, "problems"));
    
    // This runs immediately AND whenever you change data in the Firebase Console
    onSnapshot(q, (snapshot) => {
        const newProblems = [];
        snapshot.forEach((doc) => {
            newProblems.push(doc.data());
        });
        
        // Update the global variable
        problems = newProblems;
        
        console.log(`Loaded ${problems.length} problems from Firebase.`);
        
        // If this is the first load, set up the UI
        if (currentProblemIndex === 0 && score === 0 && timeLeft === 180) {
             // Optional: Update UI to say "Ready"
        }
    });
}

/* ================= 4. CORE GAME FUNCTIONS ================= */

function loadProblem() {
    if (problems.length === 0) return; // Guard clause if data isn't loaded

    const currentProblem = problems[currentProblemIndex];
    const questionNumber = currentProblemIndex + 1;

    // Update UI
    document.querySelector('h2').innerText = 
        `Problem ${questionNumber}: ${currentProblem.title} (${currentProblem.points} points)`;
    targetBox.innerHTML = `$$${currentProblem.latex}$$`;

    // Reset Input
    inputField.value = "";
    previewBox.innerHTML = "";

    // Render Math
    if (window.MathJax) {
        MathJax.typesetPromise([targetBox]).catch((err) => console.log(err));
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function startGame() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';

    shuffleArray(problems);

    currentProblemIndex = 0;
    score = 0;
    problemsSolved = 0;
    timeLeft = 180; 
    document.querySelector('.score').innerText = `Score: 0`;

    loadProblem();
    startTimer();
    inputField.focus();
}

function skipProblem() {
    currentProblemIndex++;
    if (currentProblemIndex >= problems.length) {
        endGame();
        return;
    }
    loadProblem();
    inputField.focus(); 
}

function endGame() {
    if (timerInterval) clearInterval(timerInterval);
    document.getElementById('game-ui').style.display = 'none';
    document.getElementById('game-over-ui').style.display = 'flex';
    document.getElementById('final-score').innerText = score;
    document.getElementById('final-problems').innerText = problemsSolved;

    // Re-enable submit button for the new game
    const submitBtn = document.querySelector('.submit-section button');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit Score";
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--; 
        document.getElementById('time-display').innerText = timeLeft;
        if (timeLeft <= 0) endGame();
    }, 1000); 
}

/* ================= 5. LIVE PREVIEW & CHECKING ================= */

const updateMath = () => {
    const latex = inputField.value;
    if (!latex.trim()) { previewBox.innerHTML = ''; return; }
    if (!window.MathJax || !MathJax.tex2chtmlPromise) return;

    MathJax.tex2chtmlPromise(latex, { display: true }).then((node) => {
        const hasError = node.querySelector('mjx-merror') || node.querySelector('.mjx-error');
        if (!hasError) {
            previewBox.innerHTML = '';
            previewBox.appendChild(node);
            MathJax.startup.document.clear();
            MathJax.startup.document.updateDocument();

            if (checkAnswer()) handleSuccess();
        }
    });
};

function checkAnswer() {
    const currentP = problems[currentProblemIndex];
    if (!currentP) return false;

    let userCode = inputField.value.replace(/\$/g, "").replace(/\s/g, "");
    const targetCode = currentP.latex.replace(/\s/g, "");

    return userCode === targetCode;
}

function handleSuccess() {
    score += problems[currentProblemIndex].points;
    problemsSolved++;
    document.querySelector('.score').innerText = `Score: ${score}`;

    inputField.style.borderColor = "#2ecc71"; 
    inputField.style.backgroundColor = "#e8f8f5"; 

    setTimeout(() => {
        inputField.style.borderColor = "#007bff"; 
        inputField.style.backgroundColor = "black"; 
        currentProblemIndex++;

        if (currentProblemIndex >= problems.length) {
            endGame();
            return;
        }
        loadProblem();
        inputField.focus();
    }, 1000);
}

/* ================= 6. LEADERBOARD LOGIC ================= */

// Listen for Live Updates
const leaderboardList = document.querySelector('.leaderboard-content');
if(leaderboardList) {
    const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
    onSnapshot(q, (snapshot) => {
        leaderboardList.innerHTML = ""; 
        let rank = 1;
        snapshot.forEach((doc) => {
            const data = doc.data();
            const row = `
                    <div class="leaderboard-row">
                    <div class="rank">#${rank}</div>
                    <div class="username">${data.name}</div>
                    <div class="score">${data.score} points</div>
                    </div>
                `;
            leaderboardList.innerHTML += row;
            rank++;
        });
        if(snapshot.empty) leaderboardList.innerHTML = "No scores yet. Be the first!";
    });
}

// Submit Score Logic
const submitBtn = document.querySelector('.submit-section button');
const nameInput = document.querySelector('.name-input');

if(submitBtn) {
    submitBtn.addEventListener('click', async () => {
        const playerName = nameInput.value.trim();
        if (!playerName) {
            alert("Please enter your name!");
            return;
        }

        submitBtn.disabled = true;
        // submitBtn.innerText = "Saving...";

        try {
            await addDoc(collection(db, "leaderboard"), {
                name: playerName,
                score: score,
                date: new Date().toLocaleDateString(),
                timestamp: Date.now()
            });
            submitBtn.innerText = "Saved!";
        } catch (e) {
            console.error("Error adding document: ", e);
            alert("Error saving score. Check console.");
            submitBtn.disabled = false;
        }
    });
}

/* ================= 7. INITIALIZATION & EVENTS ================= */

// Start everything when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    subscribeToProblems();
    checkMathJax(); 
    
    // Start Game
    const startBtn = document.getElementById('btn-start');
    if (startBtn) startBtn.addEventListener('click', startGame);

    // End Game
    const endBtn = document.getElementById('btn-end');
    if (endBtn) endBtn.addEventListener('click', endGame);

    // Skip
    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) skipBtn.addEventListener('click', skipProblem);

    // Play Again (FIXED ID HERE)
    const playAgainBtn = document.getElementById('btn-play-again'); // Matches HTML ID
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => location.reload());
    } else {
        console.error("Play Again button not found!");
    }
});

// MathJax Checker
function checkMathJax() {
    if (window.MathJax && window.MathJax.typesetPromise) {
        console.log("MathJax Ready");
    } else {
        setTimeout(checkMathJax, 100);
    }
}

// Typing Listener
inputField.addEventListener('input', updateMath);





