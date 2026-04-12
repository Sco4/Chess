// firebase-multiplayer.js

// Глобальні змінні для мультиплеєра
let currentRoomId = null;
let myOnlineColor = null; 
let isOnlineGame = false;
let moveListener = null;

// Функція генерації випадкового коду кімнати
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Створити нову кімнату
function createRoom() {
    const roomId = generateRoomCode();
    const roomRef = database.ref('rooms/' + roomId);
    
    roomRef.set({
        status: 'waiting',
        creatorName: currentUser,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        currentRoomId = roomId;
        myOnlineColor = 'w';
        isOnlineGame = true;
        
        document.getElementById('opponent-status').innerHTML = `Очікування суперника... (Код: <b>${roomId}</b>) 🔴`;
        document.getElementById('leave-room-btn').classList.remove('hidden');
        document.getElementById('settings-modal').classList.add('hidden');
        
        // Чекаємо на підключення суперника
        roomRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.status === 'playing') {
                document.getElementById('opponent-status').innerHTML = `Суперник: ${data.joinerName} 🟢`;
                startListeningForMoves();
                startOnlineGameLocally('w', data.joinerName);
                // Вимикаємо цей слухач після початку гри
                roomRef.off('value'); 
                // Але запускаємо новий для відстеження статусу (здача/вихід)
                listenForRoomStatus();
            }
        });
    }).catch(error => {
        console.error("Помилка створення кімнати:", error);
        alert("Не вдалося створити кімнату.");
    });
}

// Приєднатися до кімнати
function joinRoom(roomId) {
    roomId = roomId.toUpperCase();
    const roomRef = database.ref('rooms/' + roomId);
    
    roomRef.once('value').then((snapshot) => {
        if (!snapshot.exists()) {
            alert("Кімнату не знайдено!");
            return;
        }
        const data = snapshot.val();
        if (data.status !== 'waiting') {
            alert("Гра вже почалася!");
            return;
        }
        
        roomRef.update({
            status: 'playing',
            joinerName: currentUser
        }).then(() => {
            currentRoomId = roomId;
            myOnlineColor = 'b';
            isOnlineGame = true;
            
            document.getElementById('opponent-status').innerHTML = `Суперник: ${data.creatorName} 🟢`;
            document.getElementById('leave-room-btn').classList.remove('hidden');
            document.getElementById('settings-modal').classList.add('hidden');
            
            startListeningForMoves();
            listenForRoomStatus();
            startOnlineGameLocally('b', data.creatorName);
        });
    });
}

// Слухач статусів кімнати (Здача, Вихід)
function listenForRoomStatus() {
    const roomRef = database.ref(`rooms/${currentRoomId}`);
    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.status === 'resigned') {
            const winnerColor = data.winner === 'w' ? 'Білі' : 'Чорні';
            const msg = data.resignerName === currentUser 
                ? `Ви здалися. Перемогли ${winnerColor}` 
                : `Суперник (${data.resignerName}) здався! Перемогли ${winnerColor}`;
            
            handleOnlineGameOver(msg);
            roomRef.off('value');
        } 
        else if (data.status === 'abandoned') {
            handleOnlineGameOver("Суперник покинув гру.");
            roomRef.off('value');
        }
    });
}

// Слухач чужих ходів
function startListeningForMoves() {
    if (moveListener) return;
    
    const movesRef = database.ref(`rooms/${currentRoomId}/moves`);
    moveListener = movesRef.on('child_added', (snapshot) => {
        const moveData = snapshot.val();
        if (moveData.color !== myOnlineColor) {
            receiveMoveFromOnline(moveData);
        }
    });
}

// Відправка свого ходу
function sendMoveOnline(moveObj, color) {
    if (!currentRoomId || !isOnlineGame) return;
    
    database.ref(`rooms/${currentRoomId}/moves`).push({
        from: moveObj.from,
        to: moveObj.to,
        promotion: moveObj.promotion || null,
        color: color,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

// Функція здачі
window.sendResignOnline = function() {
    if (!currentRoomId || !isOnlineGame) return;
    
    database.ref(`rooms/${currentRoomId}`).update({
        status: 'resigned',
        winner: (myOnlineColor === 'w' ? 'b' : 'w'),
        resignerName: currentUser
    });
};

function leaveRoom() {
    if (currentRoomId) {
        database.ref(`rooms/${currentRoomId}/status`).set('abandoned');
        database.ref(`rooms/${currentRoomId}`).off();
        if (moveListener) {
            database.ref(`rooms/${currentRoomId}/moves`).off('child_added', moveListener);
            moveListener = null;
        }
    }
    
    currentRoomId = null;
    myOnlineColor = null;
    isOnlineGame = false;
    document.getElementById('leave-room-btn').classList.add('hidden');
    document.getElementById('opponent-status').innerHTML = `Суперник: Людина`;
}