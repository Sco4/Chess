// firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyA4rJGpu68zVf0K_iG8A2wEO9Ck_nWOWdg",
    authDomain: "chess-for-friends-2444d.firebaseapp.com",
    databaseURL: "https://chess-for-friends-2444d-default-rtdb.europe-west1.firebasedatabase.app", // Adjust if needed, but it usually infers from project id, or we provide it explicitly. Usually not needed for default DB in US, but safe to let SDK handle. Actually, let's omit databaseURL if it's default auto-detected.
    projectId: "chess-for-friends-2444d",
    storageBucket: "chess-for-friends-2444d.firebasestorage.app",
    messagingSenderId: "899874482468",
    appId: "1:899874482468:web:cb786a9cbfef51d7086bb1"
};

// Ініціалізуємо Firebase (ми підключимо скрипти firebase-app-compat та firebase-database-compat в HTML)
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
