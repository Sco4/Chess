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
    
    // Встановлюємо стартовий стан
    roomRef.set({
        status: 'waiting',
        creatorName: currentUser, // Використовуємо ім'я з auth.js
        createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        currentRoomId = roomId;
        myOnlineColor = 'w';
        isOnlineGame = true;
        
        // Показуємо код користувачу в маленькому індикаторі
        document.getElementById('opponent-status').innerHTML = `Очікування суперника... (Код: <b>${roomId}</b>) 🔴`;
        document.getElementById('leave-room-btn').classList.remove('hidden');
        
        // Миттєво закриваємо вікно налаштувань, щоб гравець побачив дошку та код
        document.getElementById('settings-modal').classList.add('hidden');
        
        // Слухаємо оновлення статусу кімнати (коли підключиться інший гравець)
        roomRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data && data.status === 'playing') {
                document.getElementById('opponent-status').innerHTML = `Суперник: ${data.joinerName} 🟢`;
                startListeningForMoves();
                
                // Перезапускаємо гру локально
                startOnlineGameLocally('w', data.joinerName);
                
                // Видалимо цей загальний слухач, щоб він не спрацьовував двічі
                roomRef.off('value');
            }
        });
    }).catch(error => {
        console.error("Помилка створення кімнати:", error);
        alert("Не вдалося створити кімнату. Перевірте підключення.");
    });
}

// Приєднатися до кімнати
function joinRoom(roomId) {
    roomId = roomId.toUpperCase();
    const roomRef = database.ref('rooms/' + roomId);
    
    roomRef.once('value').then((snapshot) => {
        if (!snapshot.exists()) {
            alert("Кімнату з таким кодом не знайдено!");
            return;
        }
        
        const data = snapshot.val();
        if (data.status !== 'waiting') {
            alert("Гра вже почалася або завершена!");
            return;
        }
        
        // Оновлюємо статус на 'playing'
        roomRef.update({
            status: 'playing',
            joinerName: currentUser
        }).then(() => {
            currentRoomId = roomId;
            myOnlineColor = 'b';
            isOnlineGame = true;
            
            document.getElementById('opponent-status').innerHTML = `Суперник: ${data.creatorName} 🟢`;
            document.getElementById('leave-room-btn').classList.remove('hidden');
            
            startListeningForMoves();
            document.getElementById('settings-modal').classList.add('hidden');
            
            startOnlineGameLocally('b', data.creatorName);
        });
    });
}

// Слухач чужих ходів
function startListeningForMoves() {
    if (moveListener) return; // вже слухаємо
    
    const movesRef = database.ref(`rooms/${currentRoomId}/moves`);
    moveListener = movesRef.on('child_added', (snapshot) => {
        const moveData = snapshot.val();
        
        // Якщо хід прийшов НЕ від нас
        if (moveData.color !== myOnlineColor) {
            receiveMoveFromOnline(moveData);
        }
    });
}

// Відправка свого ходу
function sendMoveOnline(moveObj, color) {
    if (!currentRoomId || !isOnlineGame) return;
    
    const movesRef = database.ref(`rooms/${currentRoomId}/moves`);
    movesRef.push({
        from: moveObj.from,
        to: moveObj.to,
        promotion: moveObj.promotion || null,
        color: color,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

function leaveRoom() {
    if (currentRoomId) {
        database.ref(`rooms/${currentRoomId}/status`).set('abandoned');
        
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
// firebase-multiplayer.js

// Додай це в кінець файлу
window.sendResignOnline = function() {
    if (!currentRoomId || !isOnlineGame) return;
    
    database.ref(`rooms/${currentRoomId}`).update({
        status: 'resigned',
        winner: (myOnlineColor === 'w' ? 'b' : 'w'),
        resignerName: currentUser
    });
};

// Онови функцію startListeningForMoves, щоб вона реагувала на статус 'resigned'
function startListeningForMoves() {
    if (moveListener) return;
    
    const roomRef = database.ref(`rooms/${currentRoomId}`);
    
    // Слухаємо зміни в самій кімнаті (для здачі)
    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.status === 'resigned') {
            const winnerColor = data.winner === 'w' ? 'Білі' : 'Чорні';
            const msg = data.resignerName === currentUser 
                ? `Ви здалися. Перемогли ${winnerColor}` 
                : `Суперник (${data.resignerName}) здався! Перемогли ${winnerColor}`;
            
            handleOnlineGameOver(msg);
            roomRef.off('value'); // Припиняємо слухати після завершення
        }
    });

    const movesRef = database.ref(`rooms/${currentRoomId}/moves`);
    moveListener = movesRef.on('child_added', (snapshot) => {
        const moveData = snapshot.val();
        if (moveData.color !== myOnlineColor) {
            receiveMoveFromOnline(moveData);
        }
    });
}