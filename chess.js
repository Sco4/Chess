const game = new Chess();
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const undoBtn = document.getElementById('undo-btn');
const cancelGameBtn = document.getElementById('cancel-game-btn');
const resignBtn = document.getElementById('resign-btn');
const resetBtn = document.getElementById('reset-btn');

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');

const timeModeSelect = document.getElementById('time-mode-select');
const durationSelect = document.getElementById('duration-select');
const incrementSelect = document.getElementById('increment-select');
const timerBlackEl = document.getElementById('timer-black');
const timerWhiteEl = document.getElementById('timer-white');

const toggle3DBtn = document.getElementById('toggle-3d-btn');
const board3DEl = document.getElementById('board-3d');
const board2DEl = document.getElementById('board');
let is3DMode = false;

const opponentSelect = document.getElementById('opponent-select');
const botLevelSelect = document.getElementById('bot-level-select');
const playerColorSelect = document.getElementById('player-color-select');
let botThinkingEl = null;

const moveLogEl = document.getElementById('move-log');
const moveLogContainer = document.getElementById('move-log-container');

// Стан аналізу та реплею
const analyzeBtn = document.getElementById('analyze-game-btn');
const progressContainer = document.getElementById('analysis-progress-container');
const progressStatus = document.getElementById('analysis-status-text');
const progressPercent = document.getElementById('analysis-percent');
const progressBar = document.getElementById('analysis-bar');
const replayControls = document.getElementById('replay-controls');
const replayText = document.getElementById('replay-text');
const replayNextBtn = document.getElementById('replay-next-btn');

let moveClassifications = [], analysisFens = [], analysisScores = [], analysisBestMoves = [];
let isAnalyzing = false, analysisWorker = null, inReplayMode = false, replayIndex = 0, replayTimer = null;
let botTurnStartTime = 0, pendingPromotionMove = null, gameType = 'human', botLevel = 3, playerColor = 'w', chessWorker = null;
let gameActive = false, useTimer = false, durationMs = 0, incrementMs = 0;
let whiteTimeMs = 0, blackTimeMs = 0, timerInterval = null, lastTimerTick = 0;

const gameOverModal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalHideBtn = document.getElementById('modal-hide-btn');

const pieceUnicode = { 'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚' };
const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const startPieces = { p: 8, n: 2, b: 2, r: 2, q: 1 };

let selectedSquare = null, possibleMoves = [];

function getSquareId(row, col) { return 'abcdefgh'[col] + (8 - row); }

function createBoard() {
    boardElement.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const squareId = getSquareId(row, col);
            const isDark = (row + col) % 2 !== 0;
            const squareEl = document.createElement('div');
            squareEl.classList.add('square', isDark ? 'dark' : 'light');
            squareEl.dataset.square = squareId;
            squareEl.addEventListener('click', () => onSquareClick(squareId));
            boardElement.appendChild(squareEl);
        }
    }
    updateBoard();
}

function updateBoard() {
    document.querySelectorAll('.square').forEach(sq => {
        sq.innerHTML = '';
        sq.classList.remove('selected', 'selected-no-moves', 'highlight', 'highlight-capture', 'in-check', 'last-move');
    });

    const boardState = game.board(), inCheck = game.in_check(), turn = game.turn();
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const squareId = getSquareId(row, col), squareEl = document.querySelector(`[data-square="${squareId}"]`);
            const piece = boardState[row][col];
            if (piece) {
                if (inCheck && piece.type === 'k' && piece.color === turn) squareEl.classList.add('in-check');
                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece');
                pieceEl.innerHTML = pieceUnicode[piece.type];
                pieceEl.style.color = piece.color === 'w' ? '#ffffff' : '#000000';
                pieceEl.style.textShadow = piece.color === 'w' ? '0px 0px 3px #000' : '0px 0px 3px #fff';
                squareEl.appendChild(pieceEl);
            }
        }
    }
    if (selectedSquare) {
        const sqSelected = document.querySelector(`[data-square="${selectedSquare}"]`);
        if(sqSelected) sqSelected.classList.add(possibleMoves.length === 0 ? 'selected-no-moves' : 'selected');
    }
    possibleMoves.forEach(move => {
        const sqEl = document.querySelector(`[data-square="${move.to}"]`);
        if (sqEl) sqEl.classList.add(move.captured || move.flags.includes('e') ? 'highlight-capture' : 'highlight');
    });

    const history = game.history({ verbose: true });
    if (history.length > 0) {
        const lastMove = history[history.length - 1];
        document.querySelector(`[data-square="${lastMove.from}"]`)?.classList.add('last-move');
        document.querySelector(`[data-square="${lastMove.to}"]`)?.classList.add('last-move');
    }

    updateStatus();
    updateMoveLog();
    updateBoardRotation();
    updateCapturedPieces();
    updateTimerDisplays();
    if (window.chess3D) window.chess3D.syncWithGameState(JSON.stringify(game.board()), game.turn(), possibleMoves, selectedSquare, game.in_check(), history);
}

function onSquareClick(squareId) {
    if (game.game_over()) return;
    if (gameType === 'bot' && game.turn() !== playerColor) return;
    if (typeof isOnlineGame !== 'undefined' && isOnlineGame && game.turn() !== myOnlineColor) return;

    const piece = game.get(squareId);
    if (selectedSquare) {
        const move = possibleMoves.find(m => m.to === squareId);
        if (move) {
            if (move.promotion) {
                pendingPromotionMove = { from: selectedSquare, to: squareId };
                document.getElementById('promotion-modal').classList.remove('hidden');
                return;
            }
            executeMove({ from: selectedSquare, to: squareId, promotion: 'q' });
            return;
        }
    }
    if (piece && piece.color === game.turn()) {
        selectedSquare = squareId;
        possibleMoves = game.moves({ square: squareId, verbose: true });
    } else {
        selectedSquare = null; possibleMoves = [];
    }
    updateBoard();
}

function executeMove(moveObj) {
    const previousTurn = game.turn();
    const moveResult = game.move(moveObj); // Робимо хід у бібліотеці chess.js
    
    if (!moveResult) return; // Якщо хід невалідний — виходимо
    
    // --- ЦЕЙ БЛОК ВАЖЛИВИЙ ДЛЯ ОНЛАЙНУ ---
    // Якщо зараз онлайн-гра і хід зробив саме поточний гравець (мій колір)
    if (typeof isOnlineGame !== 'undefined' && isOnlineGame && moveResult.color === myOnlineColor) {
        if (typeof sendMoveOnline === 'function') {
            sendMoveOnline(moveResult, moveResult.color);
        }
    }
    // ------------------------------------

    if (!gameActive) {
        gameActive = true; 
        settingsBtn.disabled = true;
        cancelGameBtn.classList.remove('hidden'); 
        resetBtn.classList.add('hidden');
    }

    if (useTimer) {
        if (game.history().length > 1) {
            if (previousTurn === 'w') whiteTimeMs += incrementMs; 
            else blackTimeMs += incrementMs;
        }
        startTimer();
    }

    selectedSquare = null; 
    possibleMoves = [];
    updateBoard();

    // Якщо граємо з ботом — даємо йому хід
    if (gameType === 'bot') checkBotTurn();
}

function handleBotWorkerMessage(e) {
    const msg = e.data;
    if (typeof msg === 'string' && msg.startsWith('bestmove')) {
        const moveStr = msg.split(' ')[1];
        if (moveStr && moveStr !== '(none)') {
            const delay = Math.max(0, 1000 - (Date.now() - botTurnStartTime));
            setTimeout(() => {
                if (!gameActive && game.history().length === 0) return;
                if (botThinkingEl) botThinkingEl.style.visibility = 'hidden';
                executeMove({ from: moveStr.substring(0, 2), to: moveStr.substring(2, 4), promotion: moveStr.charAt(4) || undefined });
            }, delay);
        }
    }
}

function checkBotTurn() {
    if (game.game_over() || (gameType === 'bot' && game.turn() === playerColor)) return;
    if (botThinkingEl) { botThinkingEl.style.display = 'block'; botThinkingEl.style.visibility = 'visible'; }
    let levels = { 1:[0,1,200], 2:[3,2,400], 3:[6,3,600], 4:[9,5,1000], 5:[12,8,1500], 6:[15,12,2500], 7:[18,16,4000], 8:[20,22,8000] };
    let [skill, depth, movetime] = levels[botLevel] || [5,4,800];
    botTurnStartTime = Date.now();
    chessWorker.postMessage(`setoption name Skill Level value ${skill}`);
    chessWorker.postMessage(`position fen ${game.fen()}`);
    chessWorker.postMessage(`go depth ${depth} movetime ${movetime}`);
}

function updateStatus() {
    let statusText = '';
    const moveColor = game.turn() === 'w' ? 'Білі' : 'Чорні';
    const opponentColor = game.turn() === 'w' ? 'Чорні' : 'Білі';

    if (game.in_checkmate()) {
        statusText = `Мат! Перемогли ${opponentColor}.`;
        modalTitle.innerText = 'МАТ!'; modalText.innerText = statusText;
        gameOverModal.classList.remove('hidden'); stopTimer(); endGame();
    } else if (game.in_draw()) {
        statusText = 'Нічия!';
        modalTitle.innerText = 'НІЧИЯ!'; modalText.innerText = 'Гра закінчилася внічию';
        gameOverModal.classList.remove('hidden'); stopTimer(); endGame();
    } else {
        statusText = `Хід: ${moveColor}${game.in_check() ? ' (Шах)' : ''}`;
    }
    statusElement.innerText = statusText;
}

function updateMoveLog() {
    const history = game.history();
    moveLogEl.innerHTML = '';
    for (let i = 0; i < history.length; i += 2) {
        const pairEl = document.createElement('div');
        pairEl.className = 'move-pair' + (i >= history.length - 2 ? ' recent' : '');
        pairEl.innerHTML = `<span class="move-number">${Math.floor(i/2)+1}.</span> <span>${history[i]}</span> <span>${history[i+1]||''}</span>`;
        moveLogEl.appendChild(pairEl);
    }
    setTimeout(() => { moveLogContainer.scrollLeft = moveLogContainer.scrollWidth; }, 50);
}

function updateBoardRotation() {
    let shouldRotate = false;
    if (gameType === 'bot') shouldRotate = (playerColor === 'b');
    else if (typeof isOnlineGame !== 'undefined' && isOnlineGame) shouldRotate = (myOnlineColor === 'b');
    else shouldRotate = (document.getElementById('rotate-offline-check')?.checked && game.turn() === 'b');

    boardElement.classList.toggle('rotate-black', shouldRotate);
    if (window.chess3D) window.chess3D.targetRotationY = shouldRotate ? Math.PI : 0;
}

function updateCapturedPieces() {
    const pieces = game.board().flat().filter(p => p);
    const captured = { w: {...startPieces}, b: {...startPieces} };
    pieces.forEach(p => { if(p.type !== 'k') captured[p.color][p.type]--; });

    const render = (id, color) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        Object.keys(captured[color]).forEach(type => {
            for(let i=0; i < captured[color][type]; i++) {
                const s = document.createElement('span'); s.innerHTML = pieceUnicode[type];
                s.style.color = color === 'w' ? '#fff' : '#000'; el.appendChild(s);
            }
        });
    };
    render('captured-white', 'b'); render('captured-black', 'w');
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    lastTimerTick = Date.now();
    timerInterval = setInterval(() => {
        const delta = Date.now() - lastTimerTick; lastTimerTick = Date.now();
        if (game.turn() === 'w') whiteTimeMs -= delta; else blackTimeMs -= delta;
        if (whiteTimeMs <= 0 || blackTimeMs <= 0) handleTimeout(game.turn() === 'w' ? 'Чорні' : 'Білі');
        updateTimerDisplays();
    }, 100);
}

function updateTimerDisplays() {
    if (!useTimer) return;
    timerWhiteEl.innerText = formatTime(whiteTimeMs);
    timerBlackEl.innerText = formatTime(blackTimeMs);
    timerWhiteEl.classList.toggle('active', game.turn() === 'w');
    timerBlackEl.classList.toggle('active', game.turn() === 'b');
}

function handleTimeout(winner) {
    stopTimer(); modalTitle.innerText = 'ЧАС ВИЙШОВ!';
    modalText.innerText = `Перемогли ${winner}`; gameOverModal.classList.remove('hidden'); endGame();
}

function stopTimer() { clearInterval(timerInterval); }
function formatTime(ms) { 
    const s = Math.max(0, Math.floor(ms/1000)); 
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; 
}

function resetGame() {
    game.reset(); stopTimer(); gameActive = false; settingsBtn.disabled = false;
    if (useTimer) { whiteTimeMs = durationMs; blackTimeMs = durationMs; }
    updateBoard();
}

function endGame() { gameActive = false; settingsBtn.disabled = false; stopTimer(); }

function getBotWorker() {
    const blob = new Blob([`importScripts("https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js");`], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.postMessage('uci'); return worker;
}

// Події кнопок
settingsSaveBtn.addEventListener('click', () => {
    gameType = opponentSelect.value;
    if (gameType === 'bot') {
        botLevel = parseInt(botLevelSelect.value); playerColor = playerColorSelect.value;
        if (!chessWorker) { chessWorker = getBotWorker(); chessWorker.onmessage = handleBotWorkerMessage; }
    }
    useTimer = (timeModeSelect.value === 'timer');
    if (useTimer) { durationMs = parseInt(durationSelect.value)*60000; incrementMs = parseInt(incrementSelect.value)*1000; }
    settingsModal.classList.add('hidden'); resetGame();
    if (gameType === 'bot' && playerColor === 'b') { gameActive = true; checkBotTurn(); }
});

undoBtn.addEventListener('click', () => {
    if (!gameActive || (typeof isOnlineGame !== 'undefined' && isOnlineGame)) return;
    game.undo(); updateBoard();
});

cancelGameBtn.addEventListener('click', resetGame);
resetBtn.addEventListener('click', resetGame);
modalCloseBtn.addEventListener('click', resetGame);
modalHideBtn.addEventListener('click', () => gameOverModal.classList.add('hidden'));

settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});

// Закриття модалки налаштувань (скасування)
settingsCancelBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

// Перемикач 2D / 3D режимів
toggle3DBtn.addEventListener('click', () => {
    is3DMode = !is3DMode;
    toggle3DBtn.innerText = is3DMode ? "2D Режим" : "3D Режим";
    
    if (is3DMode) {
        board2DEl.classList.add('hidden');
        board3DEl.classList.remove('hidden');
        document.body.classList.add('mode-3d');
        
        // Ініціалізуємо 3D сцену, якщо вона ще не створена
        if (!window.chess3D) {
            window.chess3D = new Chess3D('board-3d');
            window.chess3D.onSquareClickCallback = onSquareClick;
        }
    } else {
        board3DEl.classList.add('hidden');
        board2DEl.classList.remove('hidden');
        document.body.classList.remove('mode-3d');
    }
    
    updateBoard(); // Оновлюємо відображення фігур
});

// Обробник для кнопки "Здатися"
resignBtn.addEventListener('click', () => {
    if (!gameActive) return;

    if (confirm("Ви дійсно хочете здатися?")) {
        // Якщо це онлайн-гра
        if (typeof isOnlineGame !== 'undefined' && isOnlineGame) {
            // Перевіряємо, чи існує функція відправки в мультиплеєрному файлі
            if (window.sendResignOnline) {
                window.sendResignOnline();
            } else {
                console.error("Помилка: функція sendResignOnline не знайдена у firebase-multiplayer.js");
            }
        } else {
            // Якщо це локальна гра або гра з ботом
            const winnerColorStr = (game.turn() === 'w') ? 'Чорні' : 'Білі';
            
            modalTitle.innerText = 'ПОРАЗКА';
            modalText.innerText = `Ви здалися. Перемогли ${winnerColorStr}`;
            
            gameOverModal.classList.remove('hidden');
            stopTimer();
            endGame();
            statusElement.innerText = "Гру завершено (Здався)";
        }
    }
});

// Обробка вибору типу суперника (показуємо/ховаємо опції бота)
// Обробка зміни типу суперника в налаштуваннях
opponentSelect.addEventListener('change', (e) => {
    const onlineOptions = document.getElementById('online-options');
    const offlineOptions = document.getElementById('offline-options');
    const botOptions = document.getElementById('bot-options'); // якщо такий блок є для вибору рівня
    
    // Ховаємо все спочатку
    if (onlineOptions) onlineOptions.style.display = 'none';
    if (offlineOptions) offlineOptions.style.display = 'none';
    if (botOptions) botOptions.style.display = 'none';

    if (e.target.value === 'bot') {
        botLevelSelect.disabled = false;
        playerColorSelect.disabled = false;
        if (botOptions) botOptions.style.display = 'block';
    } else if (e.target.value === 'online') {
        botLevelSelect.disabled = true;
        playerColorSelect.disabled = true;
        // ПОКАЗУЄМО блок з кнопками "Створити" та "Приєднатися"
        if (onlineOptions) {
            onlineOptions.style.display = 'block';
            onlineOptions.classList.remove('hidden'); // на випадок якщо використовується CSS клас
        }
    } else {
        // Режим гри з другом на одному ПК
        botLevelSelect.disabled = true;
        playerColorSelect.disabled = true;
        if (offlineOptions) offlineOptions.style.display = 'block';
    }
    
    // Перевірка лімітів часу (якщо функція існує)
    if (typeof enforceTimeLimits === 'function') {
        enforceTimeLimits();
    }
});

// Перемикач режиму часу
timeModeSelect.addEventListener('change', (e) => {
    const timerEnabled = (e.target.value === 'timer');
    durationSelect.disabled = !timerEnabled;
    incrementSelect.disabled = !timerEnabled;
});


// --- ОБРОБНИКИ ДЛЯ ОНЛАЙН-КНОПОК ---

// Кнопка "Створити кімнату"
const createRoomBtn = document.getElementById('create-room-btn');
if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
        if (typeof createRoom === 'function') {
            createRoom(); // Викликаємо функцію з firebase-multiplayer.js
        } else {
            console.error("Помилка: функція createRoom не знайдена");
        }
    });
}

// Кнопка "Приєднатися до кімнати"
const joinRoomBtn = document.getElementById('join-room-btn');
const joinRoomInput = document.getElementById('join-room-input');
if (joinRoomBtn && joinRoomInput) {
    joinRoomBtn.addEventListener('click', () => {
        const roomId = joinRoomInput.value.trim();
        if (roomId.length >= 5) {
            if (typeof joinRoom === 'function') {
                joinRoom(roomId); // Викликаємо функцію з firebase-multiplayer.js
            } else {
                console.error("Помилка: функція joinRoom не знайдена");
            }
        } else {
            alert("Будь ласка, введіть коректний код кімнати (5 символів)");
        }
    });
}

// Кнопка "Покинути кімнату" (та, що на головній панелі)
const leaveRoomBtn = document.getElementById('leave-room-btn');
if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener('click', () => {
        if (confirm("Ви дійсно хочете покинути кімнату? Гру буде перервано.")) {
            if (typeof leaveRoom === 'function') {
                leaveRoom();
                location.reload(); // Перезавантажуємо сторінку для чистоти стану
            }
        }
    });
}
// Старт
createBoard();