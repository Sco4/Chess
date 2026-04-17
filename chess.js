const game = new Chess();
const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const undoBtn = document.getElementById('undo-btn');
const cancelGameBtn = document.getElementById('cancel-game-btn');
const resignBtn = document.getElementById('resign-btn');
const resetBtn = document.getElementById('reset-btn');

// Налаштування та Таймери
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');

const timeModeSelect = document.getElementById('time-mode-select');
const timeOptions = document.getElementById('time-options');
const durationSelect = document.getElementById('duration-select');
const incrementSelect = document.getElementById('increment-select');

const timerBlackEl = document.getElementById('timer-black');
const timerWhiteEl = document.getElementById('timer-white');

// 3D toggle
const toggle3DBtn = document.getElementById('toggle-3d-btn');
const board3DEl = document.getElementById('board-3d');
const board2DEl = document.getElementById('board');
let is3DMode = false;

// Боти та налаштування
const opponentSelect = document.getElementById('opponent-select');
const botOptions = document.getElementById('bot-options');
const botLevelSelect = document.getElementById('bot-level-select');
const playerColorSelect = document.getElementById('player-color-select');
let botThinkingEl = null;

const moveLogEl = document.getElementById('move-log');
const moveLogContainer = document.getElementById('move-log-container');

// Стан аналізу партії
const analyzeBtn = document.getElementById('analyze-game-btn');
const progressContainer = document.getElementById('analysis-progress-container');
const progressStatus = document.getElementById('analysis-status-text');
const progressPercent = document.getElementById('analysis-percent');
const progressBar = document.getElementById('analysis-bar');

const replayControls = document.getElementById('replay-controls');
const replayText = document.getElementById('replay-text');
const replayNextBtn = document.getElementById('replay-next-btn');

let moveClassifications = [];
let analysisFens = [];
let analysisScores = [];
let analysisBestMoves = [];
let fullGameHistory = null;
let currentAnalysisIndex = 0;
let isAnalyzing = false;
let analysisWorker = null;
let tempScore = 0;
let analyzeMode = 'key';
let analyzeOnlyPlayer = false;
let gameStarted = false;

let inReplayMode = false;
let replayIndex = 0;
let replayTimer = null;

let botTurnStartTime = 0;
let pendingPromotionMove = null;

let gameType = 'human'; // 'human', 'bot'
let botLevel = 3;
let playerColor = 'w';
let chessWorker = null;

// Змінні налаштувань
let gameActive = false; // Визначає, чи йде зараз гра
let useTimer = false;
let durationMs = 0;
let incrementMs = 0;

let whiteTimeMs = 0;
let blackTimeMs = 0;
let timerInterval = null;
let lastTimerTick = 0;

// Модальне вікно
const gameOverModal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalHideBtn = document.getElementById('modal-hide-btn');

const pieceUnicode = {
    'p': '♟\uFE0E', 'n': '♞\uFE0E', 'b': '♝\uFE0E', 'r': '♜\uFE0E', 'q': '♛\uFE0E', 'k': '♚\uFE0E'
};

const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const startPieces = { p: 8, n: 2, b: 2, r: 2, q: 1 };

let selectedSquare = null;
let possibleMoves = [];

function getSquareId(row, col) {
    const files = 'abcdefgh';
    return files[col] + (8 - row);
}

function createBoard() {
    boardElement.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const squareId = getSquareId(row, col);
            const isDark = (row + col) % 2 !== 0;
            
            const squareEl = document.createElement('div');
            squareEl.classList.add('square');
            squareEl.classList.add(isDark ? 'dark' : 'light');
            squareEl.dataset.square = squareId;
            
            squareEl.addEventListener('click', () => onSquareClick(squareId));
            
            boardElement.appendChild(squareEl);
        }
    }
    updateBoard();
}

function updateBoard() {
    // Очищаємо дошку
    document.querySelectorAll('.square').forEach(sq => {
        sq.innerHTML = '';
        sq.classList.remove('selected', 'selected-no-moves', 'highlight', 'highlight-capture', 'in-check', 'last-move');
    });

    const boardState = game.board();
    const inCheck = game.in_check();
    const turn = game.turn();
    
    // Розставляємо фігури та координати
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const squareId = getSquareId(row, col);
            const squareEl = document.querySelector(`[data-square="${squareId}"]`);
            const isDark = (row + col) % 2 !== 0;
            
            const coordColor = isDark ? 'var(--light-square)' : 'var(--dark-square)';
            
            if (row === 7) {
                const fileLabel = document.createElement('div');
                fileLabel.className = 'coord coord-file';
                fileLabel.innerText = "abcdefgh"[col];
                fileLabel.style.color = coordColor;
                squareEl.appendChild(fileLabel);
            }
            if (col === 0) {
                const rankLabel = document.createElement('div');
                rankLabel.className = 'coord coord-rank';
                rankLabel.innerText = 8 - row;
                rankLabel.style.color = coordColor;
                squareEl.appendChild(rankLabel);
            }

            const piece = boardState[row][col];
            if (piece) {
                if (inCheck && piece.type === 'k' && piece.color === turn) {
                    squareEl.classList.add('in-check');
                }

                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece');
                pieceEl.innerHTML = pieceUnicode[piece.type];
                
                if (piece.color === 'w') {
                    pieceEl.style.color = '#ffffff';
                    pieceEl.style.textShadow = '0px 0px 3px #000000, 0px 0px 5px #000000';
                } else {
                    pieceEl.style.color = '#000000';
                    pieceEl.style.textShadow = '0px 0px 3px #ffffff, 0px 0px 5px #ffffff';
                }
                
                squareEl.appendChild(pieceEl);
            }
        }
    }

    if (selectedSquare) {
        const sqSelected = document.querySelector(`[data-square="${selectedSquare}"]`);
        if(sqSelected) {
            // Якщо немає можливих кроків - помаранчевий
            if (possibleMoves.length === 0) {
                sqSelected.classList.add('selected-no-moves');
            } else {
                sqSelected.classList.add('selected');
            }
        }
    }

    possibleMoves.forEach(move => {
        const sqEl = document.querySelector(`[data-square="${move.to}"]`);
        if (sqEl) {
            if (move.captured || move.flags.includes('e')) {
                sqEl.classList.add('highlight-capture');
            } else {
                sqEl.classList.add('highlight');
            }
        }
    });

    // Підсвічуємо останній хід
    const history = game.history({ verbose: true });
    if (history.length > 0) {
        const lastMove = history[history.length - 1];
        const fromSq = document.querySelector(`[data-square="${lastMove.from}"]`);
        const toSq = document.querySelector(`[data-square="${lastMove.to}"]`);
        if (fromSq) fromSq.classList.add('last-move');
        if (toSq) toSq.classList.add('last-move');
    }

    updateStatus();
    updateMoveLog();
    updateBoardRotation();
    updateCapturedPieces();
    updateTimerDisplays();
    
    // Синхронізуємо 3D дошку, якщо вона ініціалізована
    if (window.chess3D) {
        window.chess3D.syncWithGameState(
            JSON.stringify(game.board()),
            game.turn(),
            possibleMoves,
            selectedSquare,
            game.in_check(),
            history  // Передаємо історію
        );
    }
}

function onSquareClick(squareId) {
    if (!gameStarted) return;
    if (game.game_over()) return;
    if (gameType === 'bot' && game.turn() !== playerColor) return;
    if (isOnlineGame && game.turn() !== myOnlineColor) return;

    const pieceOnSquare = game.get(squareId);
    
    // Спроба зробити хід
    if (selectedSquare) {
        const move = possibleMoves.find(m => m.to === squareId);
        
        if (move) {
            if (move.promotion) {
                pendingPromotionMove = { from: selectedSquare, to: squareId };
                document.getElementById('promotion-modal').classList.remove('hidden');
                return; // Зупиняємо функцію і чекаємо на клік у модалці
            }
            
            executeMove({
                from: selectedSquare,
                to: squareId,
                promotion: 'q' 
            });
            return;
        }
    }

    // Вибір фігури
    if (pieceOnSquare && pieceOnSquare.color === game.turn()) {
        selectedSquare = squareId;
        possibleMoves = game.moves({ square: squareId, verbose: true });
        updateBoard();
    } else {
        selectedSquare = null;
        possibleMoves = [];
        updateBoard();
    }
}

function executeMove(moveObj) {
    const previousTurn = game.turn();
    
    const moveResult = game.move(moveObj);
    if (!moveResult) return;
    
    if (isOnlineGame && moveResult.color === myOnlineColor) {
        sendMoveOnline({
            from: moveResult.from,
            to: moveResult.to,
            promotion: moveResult.promotion
        }, moveResult.color);
    }
    
    if (!gameActive) {
        gameActive = true;
        settingsBtn.disabled = true;
        cancelGameBtn.classList.remove('hidden');
        resetBtn.classList.add('hidden');
    }

    if (useTimer) {
        if (game.history().length > 1) {
            if (previousTurn === 'w') {
                whiteTimeMs += incrementMs;
            } else {
                blackTimeMs += incrementMs;
            }
        }
        startTimer();
    }
    
    selectedSquare = null;
    possibleMoves = [];
    updateBoard();
    
    if (gameType === 'bot') {
        checkBotTurn();
    }
}

// Обробка кнопок перетворення пішака
document.querySelectorAll('.promotion-piece').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (!pendingPromotionMove) return;
        
        const pieceType = e.target.getAttribute('data-piece');
        document.getElementById('promotion-modal').classList.add('hidden');
        
        executeMove({
            from: pendingPromotionMove.from,
            to: pendingPromotionMove.to,
            promotion: pieceType
        });
        
        pendingPromotionMove = null;
    });
});

document.getElementById('promotion-cancel-btn').addEventListener('click', () => {
    document.getElementById('promotion-modal').classList.add('hidden');
    pendingPromotionMove = null;
});

// Інтеграція мультиплеєра Firebase
window.receiveMoveFromOnline = function(moveData) {
    const moveResult = game.move({
        from: moveData.from,
        to: moveData.to,
        promotion: moveData.promotion
    });
    
    if (!moveResult) return;

    if (!gameActive) {
        gameActive = true;
        settingsBtn.disabled = true;
        cancelGameBtn.classList.remove('hidden');
        resetBtn.classList.add('hidden');
    }
    
    if (useTimer) {
        // ... (таймер може викликати розсинхрон, але для простоти працює локально)
        startTimer();
    }
    
    selectedSquare = null;
    possibleMoves = [];
    updateBoard();
};

window.startOnlineGameLocally = function(color, opponentName) {
    playerColor = color; // для повороту дошки
    gameType = 'online';
    resetGame();
    // Відновлюємо статус після ресету (бо ресет його скидає)
    gameActive = true; 
    gameStarted = true;
    settingsBtn.disabled = true;
    cancelGameBtn.classList.remove('hidden');
    resignBtn.classList.remove('hidden');
    resignBtn.disabled = false;
    undoBtn.disabled = true;
    resetBtn.classList.add('hidden');
    document.getElementById('opponent-status').innerHTML = `Суперник: ${opponentName} 🟢`;
};

document.getElementById('create-room-btn').addEventListener('click', () => {
    createRoom();
});

document.getElementById('join-room-btn').addEventListener('click', () => {
    const code = document.getElementById('join-room-input').value.trim();
    if(code) {
        joinRoom(code);
    }
});

document.getElementById('leave-room-btn').addEventListener('click', () => {
    leaveRoom();
    resetGame();
});

resignBtn.addEventListener('click', () => {
    if (!gameActive) return;
    if (confirm("Ви дійсно хочете здатися?")) {
        if (isOnlineGame) {
            if (window.sendResignOnline) window.sendResignOnline();
        } else {
            // Якщо гра з ботом і зараз мій хід, то я здаюсь (виграв комп)
            // Якщо гра локальна, той хто ходить - той здається (виграє наступний)
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

window.handleOnlineGameOver = function(msg) {
    modalTitle.innerText = 'КІНЕЦЬ ГРИ';
    modalText.innerText = msg;
    gameOverModal.classList.remove('hidden');
    stopTimer();
    endGame();
    statusElement.innerText = "Гру завершено";
};

function updateMoveLog() {
    const history = game.history(); // масив SAN ["e4", "e5", "Nf3"...]
    moveLogEl.innerHTML = '';
    
    for (let i = 0; i < history.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const whiteMove = history[i];
        const blackMove = history[i + 1] || '';
        
        const whiteMark = moveClassifications[i] ? `<span style="font-size: 0.8em; margin-left: 2px;">${moveClassifications[i]}</span>` : '';
        const blackMark = moveClassifications[i + 1] ? `<span style="font-size: 0.8em; margin-left: 2px;">${moveClassifications[i + 1]}</span>` : '';
        
        const isRecent = (i === history.length - 1) || (i + 1 === history.length - 1);
        
        const pairEl = document.createElement('div');
        pairEl.className = 'move-pair' + (isRecent ? ' recent' : '');
        
        pairEl.innerHTML = `<span class="move-number">${moveNum}.</span> <span>${whiteMove}${whiteMark}</span> <span>${blackMove}${blackMark}</span>`;
        
        moveLogEl.appendChild(pairEl);
    }
    
    // Плавний авто-скрол в кінець
    setTimeout(() => {
        moveLogContainer.scrollLeft = moveLogContainer.scrollWidth;
    }, 50);
}

function updateStatus() {
    let statusText = '';
    const moveColor = game.turn() === 'w' ? 'Білі' : 'Чорні';
    const opponentColor = game.turn() === 'w' ? 'Чорні' : 'Білі';

    if (game.in_checkmate()) {
        statusText = `Мат! Перемогли ${opponentColor}.`;
        modalTitle.innerText = 'МАТ!';
        modalText.innerText = `Перемогли ${opponentColor}`;
        gameOverModal.classList.remove('hidden');
        stopTimer();
        endGame();
    } else if (game.in_draw()) {
        statusText = 'Нічия!';
        modalTitle.innerText = 'НІЧИЯ!';
        modalText.innerText = 'Гра закінчилася внічию';
        gameOverModal.classList.remove('hidden');
        stopTimer();
        endGame();
    } else {
        statusText = `Хід: ${moveColor}`;
        if (game.in_check()) {
            statusText += ' (Шах)';
        }
    }

    statusElement.innerText = statusText;
}

function updateBoardRotation() {
    if (gameType === 'bot') {
        if (playerColor === 'w') {
            boardElement.classList.remove('rotate-black');
            if (window.chess3D) window.chess3D.targetRotationY = 0;
        } else {
            boardElement.classList.add('rotate-black');
            if (window.chess3D) window.chess3D.targetRotationY = Math.PI;
        }
    } else if (isOnlineGame || gameType === 'online') {
        const pColor = myOnlineColor || playerColor;
        if (pColor === 'w') {
            boardElement.classList.remove('rotate-black');
            if (window.chess3D) window.chess3D.targetRotationY = 0;
        } else {
            boardElement.classList.add('rotate-black');
            if (window.chess3D) window.chess3D.targetRotationY = Math.PI;
        }
    } else {
        // У режимі 2 гравців крутимо за ходом, тільки якщо галочка активна
        const rotateOffline = document.getElementById('rotate-offline-check').checked;
        if (rotateOffline && game.turn() === 'b') {
            boardElement.classList.add('rotate-black');
            if (window.chess3D) window.chess3D.targetRotationY = Math.PI;
        } else {
            boardElement.classList.remove('rotate-black');
            if (window.chess3D) window.chess3D.targetRotationY = 0;
        }
    }
}

// ======================== ТАЙМЕРИ ТА НАЛАШТУВАННЯ ========================

function updateCapturedPieces() {
    const currentPieces = { w: { p:0,n:0,b:0,r:0,q:0 }, b: { p:0,n:0,b:0,r:0,q:0 } };
    const boardState = game.board();
    
    for(let row=0;row<8;row++){
        for(let col=0;col<8;col++){
            const p = boardState[row][col];
            if (p && p.type !== 'k') {
                currentPieces[p.color][p.type]++;
            }
        }
    }
    
    const capturedByWhite = [];
    let wScore = 0;
    const capturedByBlack = [];
    let bScore = 0;
    
    const types = ['q', 'r', 'b', 'n', 'p']; // Від найцінніших до найслабших
    types.forEach(t => {
        // Якщо на початку 8 пішаків, а зараз 7, значить 1 пішак збито.
        const capturedBlackCount = Math.max(0, startPieces[t] - currentPieces.b[t]);
        const capturedWhiteCount = Math.max(0, startPieces[t] - currentPieces.w[t]);
        
        for(let i=0; i<capturedBlackCount; i++) {
            capturedByWhite.push({ type: t, color: 'b' });
            wScore += pieceValues[t]; // Вага збитих фігур противника додається мені
        }
        for(let i=0; i<capturedWhiteCount; i++) {
            capturedByBlack.push({ type: t, color: 'w' });
            bScore += pieceValues[t];
        }
    });

    const wAdv = wScore - bScore;
    const bAdv = bScore - wScore;

    renderCaptured('captured-white', capturedByWhite, wAdv);
    renderCaptured('captured-black', capturedByBlack, bAdv);
}

function renderCaptured(elementId, pieces, adv) {
    const el = document.getElementById(elementId);
    
    // Показуємо панель лише якщо є хоч одна збита фігура, або гра почалася
    if (pieces.length === 0 && !gameActive) {
        el.classList.add('hidden');
        return;
    }
    
    el.classList.remove('hidden');
    el.innerHTML = '';
    
    let currentType = null;
    let groupContainer = null;
    
    pieces.forEach(p => {
        // Якщо тип фігури змінився (напр. після пішаків йдуть слони), створюємо нову групу
        if (currentType !== p.type) {
            currentType = p.type;
            groupContainer = document.createElement('div');
            groupContainer.style.display = 'flex';
            groupContainer.style.alignItems = 'center';
            el.appendChild(groupContainer);
        }
        
        const span = document.createElement('span');
        span.innerHTML = pieceUnicode[p.type];
        
        // Перекриваємо фігури всередині групи (крім першої)
        if (groupContainer.children.length > 0) {
            span.style.marginLeft = '-15px'; // Ще більший нахист одна на одну
        }
        
        if (p.color === 'w') {
            span.style.color = '#ffffff';
            span.style.textShadow = '0px 0px 2px #000';
        } else {
            span.style.color = '#000000';
            span.style.textShadow = '0px 0px 2px #fff';
        }
        groupContainer.appendChild(span);
    });
    
    if (adv > 0) {
        const span = document.createElement('span');
        span.className = 'captured-score';
        span.innerText = `+${adv}`;
        el.appendChild(span);
    }
}

toggle3DBtn.addEventListener('click', () => {
    is3DMode = !is3DMode;
    toggle3DBtn.innerText = is3DMode ? "2D Режим" : "3D Режим";
    
    if (is3DMode) {
        board2DEl.classList.add('hidden');
        board3DEl.classList.remove('hidden');
        document.body.classList.add('mode-3d');
        // Ініціалізуємо тільки при першому відкритті
        if (!window.chess3D) {
            window.chess3D = new Chess3D('board-3d');
            window.chess3D.onSquareClickCallback = onSquareClick;
        }
    } else {
        board3DEl.classList.add('hidden');
        board2DEl.classList.remove('hidden');
        document.body.classList.remove('mode-3d');
    }
    
    updateBoard();
});

function enforceTimeLimits() {
    Array.from(durationSelect.options).forEach(opt => {
        opt.disabled = false;
    });

    if (opponentSelect.value === 'bot') {
        const level = parseInt(botLevelSelect.value);
        if (level === 8) {
            // Забороняємо вибирати 3, 5, 10 хвилин для рівня 8
            Array.from(durationSelect.options).forEach(opt => {
                if (parseInt(opt.value) < 20) {
                    opt.disabled = true;
                }
            });
            if (parseInt(durationSelect.value) < 20) {
                durationSelect.value = '20';
            }
        } else if (level === 7) {
             // Забороняємо вибирати 3, 5 хвилин для рівня 7
             Array.from(durationSelect.options).forEach(opt => {
                if (parseInt(opt.value) < 10) {
                    opt.disabled = true;
                }
            });
            if (parseInt(durationSelect.value) < 10) {
                durationSelect.value = '10';
            }
        }
    }
}

opponentSelect.addEventListener('change', (e) => {
    const onlineOptions = document.getElementById('online-options');
    const offlineOptions = document.getElementById('offline-options');
    
    if (e.target.value === 'bot') {
        botLevelSelect.disabled = false;
        playerColorSelect.disabled = false;
        onlineOptions.style.display = 'none';
        offlineOptions.style.display = 'none';
    } else if (e.target.value === 'online') {
        botLevelSelect.disabled = true;
        playerColorSelect.disabled = true;
        onlineOptions.style.display = 'block';
        offlineOptions.style.display = 'none';
    } else {
        botLevelSelect.disabled = true;
        playerColorSelect.disabled = true;
        onlineOptions.style.display = 'none';
        offlineOptions.style.display = 'block';
    }
    enforceTimeLimits();
});

botLevelSelect.addEventListener('change', () => {
    enforceTimeLimits();
});

timeModeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'timer') {
        durationSelect.disabled = false;
        incrementSelect.disabled = false;
    } else {
        durationSelect.disabled = true;
        incrementSelect.disabled = true;
    }
});

settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
});

settingsCancelBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

settingsSaveBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    
    if (window.isOnlineGame && opponentSelect.value !== 'online') {
        if (window.leaveRoom) window.leaveRoom();
    }
    
    gameType = opponentSelect.value;
    if (gameType === 'bot') {
        botLevel = parseInt(botLevelSelect.value);
        playerColor = playerColorSelect.value;
        if (!chessWorker) {
            chessWorker = getBotWorker();
            chessWorker.onmessage = handleBotWorkerMessage;
        }
        
        // Якщо 8 рівень і вибрано час, який менший за 20 хв - форсуємо без часу
        if (botLevel === 8 && timeModeSelect.value === 'timer') {
            const selectedDur = parseInt(durationSelect.value);
            if (selectedDur < 20) {
                timeModeSelect.value = 'none';
                durationSelect.disabled = true;
                incrementSelect.disabled = true;
            }
        }

        // Якщо 7 рівень і вибрано час, який менший за 10 хв - форсуємо без часу
        if (botLevel === 7 && timeModeSelect.value === 'timer') {
            const selectedDur = parseInt(durationSelect.value);
            if (selectedDur < 10) {
                timeModeSelect.value = 'none';
                durationSelect.disabled = true;
                incrementSelect.disabled = true;
            }
        }
        
    } else {
        if (chessWorker) {
            chessWorker.terminate();
            chessWorker = null;
        }
    }

    if (timeModeSelect.value === 'timer') {
        useTimer = true;
        durationMs = parseInt(durationSelect.value) * 60 * 1000;
        incrementMs = parseInt(incrementSelect.value) * 1000;
    } else {
        useTimer = false;
    }

    resetGame();
});

function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateTimerDisplays() {
    if (useTimer) {
        timerBlackEl.classList.remove('hidden');
        timerWhiteEl.classList.remove('hidden');
        
        timerWhiteEl.innerText = formatTime(whiteTimeMs);
        timerBlackEl.innerText = formatTime(blackTimeMs);

        // Підсвічуємо активний таймер
        if (gameActive && !game.game_over()) {
            if (game.turn() === 'w') {
                timerWhiteEl.classList.add('active');
                timerBlackEl.classList.remove('active');
            } else {
                timerBlackEl.classList.add('active');
                timerWhiteEl.classList.remove('active');
            }
        } else {
            timerWhiteEl.classList.remove('active');
            timerBlackEl.classList.remove('active');
        }

        // Червоне підсвічування якщо мало часу (менше 30 сек)
        if (whiteTimeMs <= 30000 && whiteTimeMs > 0) timerWhiteEl.classList.add('danger');
        else timerWhiteEl.classList.remove('danger');
        
        if (blackTimeMs <= 30000 && blackTimeMs > 0) timerBlackEl.classList.add('danger');
        else timerBlackEl.classList.remove('danger');

    } else {
        timerBlackEl.classList.add('hidden');
        timerWhiteEl.classList.add('hidden');
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    lastTimerTick = Date.now();
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTimerTick;
        lastTimerTick = now;
        
        if (game.turn() === 'w') {
            whiteTimeMs -= delta;
            if (whiteTimeMs <= 0) {
                whiteTimeMs = 0;
                handleTimeout('Чорні');
            }
        } else {
            blackTimeMs -= delta;
            if (blackTimeMs <= 0) {
                blackTimeMs = 0;
                handleTimeout('Білі');
            }
        }
        updateTimerDisplays();
    }, 50);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
}

function handleTimeout(winnerColor) {
    stopTimer();
    updateTimerDisplays();
    
    const statusText = `Час вийшов! Перемогли ${winnerColor}.`;
    statusElement.innerText = statusText;
    modalTitle.innerText = 'ЧАС ВИЙШОВ!';
    modalText.innerText = statusText;
    gameOverModal.classList.remove('hidden');
    endGame();
}

function resetGame() {
    game.reset();
    selectedSquare = null;
    possibleMoves = [];
    
    moveClassifications = [];
    analysisBestMoves = [];
    if (analysisWorker) {
        analysisWorker.terminate();
        analysisWorker = null;
    }
    isAnalyzing = false;
    inReplayMode = false;
    if (replayTimer) clearTimeout(replayTimer);
    progressContainer.style.display = 'none';
    replayControls.style.display = 'none';
    moveLogContainer.style.display = 'none';
    
    gameActive = false;
    gameStarted = false;
    resetBtn.innerText = "СТАРТ";
    settingsBtn.disabled = false;
    undoBtn.disabled = false;
    
    if (botThinkingEl) botThinkingEl.style.visibility = 'hidden';
    
    document.getElementById('bot-thinking-white').style.display = 'none';
    document.getElementById('bot-thinking-black').style.display = 'none';
    
    cancelGameBtn.classList.add('hidden');
    resignBtn.classList.add('hidden');
    resetBtn.classList.remove('hidden'); // if we want a manual reset button before game starts
    
    if (gameType === 'bot') {
        document.getElementById('opponent-status').innerText = `Суперник: Комп'ютер (Рівень ${botLevel})`;
        // Assign the active thinking label
        botThinkingEl = (playerColor === 'w') ? document.getElementById('bot-thinking-black') : document.getElementById('bot-thinking-white');
        botThinkingEl.style.display = 'block';
        botThinkingEl.style.visibility = 'hidden';
    } else {
        document.getElementById('opponent-status').innerText = `Суперник: Другий гравець`;
        botThinkingEl = null;
    }
    
    stopTimer();
    if (useTimer) {
        whiteTimeMs = durationMs;
        blackTimeMs = durationMs;
    }
    
    gameOverModal.classList.add('hidden');
    updateBoard();
}

function endGame() {
    gameActive = false;
    settingsBtn.disabled = false;
    if (botThinkingEl) botThinkingEl.style.visibility = 'hidden';
    cancelGameBtn.classList.add('hidden');
    resignBtn.classList.add('hidden');
    resetBtn.classList.remove('hidden');
}


// Управління партією
cancelGameBtn.addEventListener('click', resetGame);
resetBtn.addEventListener('click', () => {
    gameStarted = true;
    resetBtn.classList.add('hidden');
    resignBtn.classList.remove('hidden');
    resignBtn.disabled = false;
    cancelGameBtn.classList.remove('hidden');
    settingsBtn.disabled = true;
    
    if (gameType === 'bot' && game.turn() !== playerColor) {
        checkBotTurn();
    }
});

// Undo action
undoBtn.addEventListener('click', () => {
    if (!gameActive) return;
    if (gameType === 'online') return;

    game.undo();
    selectedSquare = null;
    possibleMoves = [];
    
    // Якщо після відміни ми на початку гри
    if (game.history().length === 0) {
        gameActive = false;
        settingsBtn.disabled = false;
        cancelGameBtn.classList.add('hidden');
        resetBtn.classList.remove('hidden');
        stopTimer();
        if (useTimer) {
            whiteTimeMs = durationMs;
            blackTimeMs = durationMs;
        }
    }
    
    updateBoard();
});

function getBotWorker() {
    const blob = new Blob([`importScripts("https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js");`], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.postMessage('uci');
    return worker;
}

function checkBotTurn() {
    if (game.game_over()) return;
    
    if (gameType === 'bot' && game.turn() !== playerColor) {
        if (botThinkingEl) botThinkingEl.style.visibility = 'visible';
        
        let skill = 0;
        let depth = 1;
        let movetime = 100;
        
        switch (botLevel) {
            case 1: skill = 0; depth = 1; movetime = 200; break;       // Сліпий новачок
            case 2: skill = 3; depth = 2; movetime = 400; break;       // Початківець
            case 3: skill = 6; depth = 3; movetime = 600; break;       // Аматор
            case 4: skill = 9; depth = 5; movetime = 1000; break;      // Любитель
            case 5: skill = 12; depth = 8; movetime = 1500; break;     // Просунутий
            case 6: skill = 15; depth = 12; movetime = 2500; break;    // Кандидат
            case 7: skill = 18; depth = 16; movetime = 4000; break;    // Майстер
            case 8: skill = 20; depth = 22; movetime = 8000; break;    // Гросмейстер
            default: skill = 5; depth = 4; movetime = 800;
        }
        
        
        botTurnStartTime = Date.now(); // Фіксуємо час початку роздумів
        chessWorker.postMessage(`setoption name Skill Level value ${skill}`);
        chessWorker.postMessage(`position fen ${game.fen()}`);
        chessWorker.postMessage(`go depth ${depth} movetime ${movetime}`);
    }
}

function handleBotWorkerMessage(e) {
    const msg = e.data;
    
    if (typeof msg === 'string' && msg.startsWith('bestmove')) {
        const parts = msg.split(' ');
        const moveStr = parts[1]; // e.g. "e2e4"
        
        if (moveStr && moveStr !== '(none)') {
            const elapsed = Date.now() - botTurnStartTime;
            const delay = Math.max(0, 1000 - elapsed);
            
            setTimeout(() => {
                if (!gameActive && game.history().length === 0) return; // Відмінили гру
                
                if (botThinkingEl) botThinkingEl.style.visibility = 'hidden'; // Ховаємо коли вже реально ходить
                const from = moveStr.substring(0, 2);
                const to = moveStr.substring(2, 4);
                const promotion = moveStr.length > 4 ? moveStr.charAt(4) : undefined;
                
                executeMove({ from, to, promotion });
            }, delay);
        } else {
            if (botThinkingEl) botThinkingEl.style.visibility = 'hidden';
        }
    }
}

modalCloseBtn.addEventListener('click', resetGame);
modalHideBtn.addEventListener('click', () => {
    gameOverModal.classList.add('hidden');
});

// Аналіз гри
analyzeBtn.addEventListener('click', () => {
    gameOverModal.classList.add('hidden');
    document.getElementById('analysis-type-modal').classList.remove('hidden');
});

document.getElementById('analyze-mine-btn').addEventListener('click', () => {
    document.getElementById('analysis-type-modal').classList.add('hidden');
    analyzeMode = document.getElementById('analysis-depth-select').value;
    analyzeOnlyPlayer = true;
    startAnalysis();
});

document.getElementById('analyze-all-btn').addEventListener('click', () => {
    document.getElementById('analysis-type-modal').classList.add('hidden');
    analyzeMode = document.getElementById('analysis-depth-select').value;
    analyzeOnlyPlayer = false;
    startAnalysis();
});

document.getElementById('analyze-cancel-btn').addEventListener('click', () => {
    document.getElementById('analysis-type-modal').classList.add('hidden');
});

function startAnalysis() {
    isAnalyzing = true;
    progressContainer.style.display = 'block';
    progressStatus.innerText = 'Збір позицій...';
    progressBar.style.width = '0%';
    progressPercent.innerText = '0%';
    
    let tempGame = new Chess();
    analysisFens = [{ fen: tempGame.fen(), over: false }]; // Позиція до 1-го ходу
    const fullHistory = game.history(); 
    fullHistory.forEach(move => {
        tempGame.move(move);
        analysisFens.push({
            fen: tempGame.fen(),
            over: tempGame.game_over(),
            mate: tempGame.in_checkmate(),
            turn: tempGame.turn()
        });
    });
    
    analysisScores = new Array(analysisFens.length).fill(0);
    analysisBestMoves = new Array(analysisFens.length).fill(null);
    moveClassifications = new Array(fullHistory.length).fill('');
    currentAnalysisIndex = 0;
    
    if (analysisWorker) analysisWorker.terminate();
    analysisWorker = getBotWorker();
    
    // Налаштовуємо максимальну точність для аналізу
    analysisWorker.postMessage('setoption name Skill Level value 20');
    analysisWorker.onmessage = handleAnalysisMessage;
    
    analyzeNextFen();
}

function analyzeNextFen() {
    if (currentAnalysisIndex >= analysisFens.length) {
        finishAnalysis();
        return;
    }
    
    const state = analysisFens[currentAnalysisIndex];
    if (state.over) {
        if (state.mate) {
            // Якщо білим поставили мат (хід білих b або w)
            analysisScores[currentAnalysisIndex] = state.turn === 'w' ? -20000 : 20000;
        } else {
            // Нічия
            analysisScores[currentAnalysisIndex] = 0; 
        }
        
        currentAnalysisIndex++;
        const perc = Math.round((currentAnalysisIndex / analysisFens.length) * 100);
        progressBar.style.width = `${perc}%`;
        progressPercent.innerText = `${perc}%`;
        progressStatus.innerText = `Аналіз ходу ${currentAnalysisIndex} з ${analysisFens.length}...`;
        
        setTimeout(analyzeNextFen, 0);
        return;
    }
    
    analysisWorker.postMessage(`position fen ${state.fen}`);
    analysisWorker.postMessage('go depth 12'); // Глибина 12 дає достатньо хороший баланс швидкості/якості у JS
}

function handleAnalysisMessage(e) {
    const msg = e.data;
    if (typeof msg !== 'string') return;
    
    if (msg.startsWith('info depth') && msg.includes('score cp')) {
        const match = msg.match(/score cp (-?\d+)/);
        if (match) {
            tempScore = parseInt(match[1]); 
            const turn = analysisFens[currentAnalysisIndex].fen.split(' ')[1];
            // Зводимо всі оцінки до перспективи Білих
            const whiteScore = turn === 'w' ? tempScore : -tempScore;
            analysisScores[currentAnalysisIndex] = whiteScore;
        }
    } else if (msg.startsWith('info depth') && msg.includes('score mate')) {
        const match = msg.match(/score mate (-?\d+)/);
        if (match) {
            const mateIn = parseInt(match[1]);
            tempScore = mateIn > 0 ? 10000 - mateIn : -10000 - mateIn;
            const turn = analysisFens[currentAnalysisIndex].fen.split(' ')[1];
            const whiteScore = turn === 'w' ? tempScore : -tempScore;
            analysisScores[currentAnalysisIndex] = whiteScore;
        }
    }
    
    if (msg.startsWith('bestmove')) {
        const parts = msg.split(' ');
        if (parts[1] && parts[1] !== '(none)') {
            analysisBestMoves[currentAnalysisIndex] = parts[1];
        }
        
        currentAnalysisIndex++;
        const perc = Math.round((currentAnalysisIndex / analysisFens.length) * 100);
        progressBar.style.width = `${perc}%`;
        progressPercent.innerText = `${perc}%`;
        progressStatus.innerText = `Аналіз ходу ${currentAnalysisIndex} з ${analysisFens.length}...`;
        
        analyzeNextFen();
    }
}

function finishAnalysis() {
    isAnalyzing = false;
    progressStatus.innerText = 'Аналіз завершено!';
    setTimeout(() => { progressContainer.style.display = 'none'; }, 2000);
    
    const fullHistory = game.history();
    for (let i = 0; i < fullHistory.length; i++) {
        const scoreBefore = analysisScores[i];
        const scoreAfter = analysisScores[i+1];
        
        // Оцінка зміни з точки зору гравця, що робив хід
        const isWhiteMove = i % 2 === 0;
        let delta = isWhiteMove ? (scoreAfter - scoreBefore) : (scoreBefore - scoreAfter);
        
        let mark = '';
        if (delta <= -400) mark = '❌';      // Бландер (Зівок)
        else if (delta <= -200) mark = '❓'; // Помилка
        else if (delta <= -80) mark = '⁉️';  // Неточність
        else if (delta <= -30) mark = '✔️';  // Добрий хід
        else if (delta < -10) mark = '👍';   // Відмінний хід
        else if (delta <= 50) mark = '🌟';   // Найкращий хід
        else if (delta <= 150) mark = '🎯';  // Чудовий хід
        else mark = '💎';                    // Діамантовий/Геніальний
        
        moveClassifications[i] = mark;
    }
    
    updateMoveLog(); // Перемалювати лог із значками!
    moveLogContainer.style.display = 'flex';
    
    // Запуск розбору партії
    startReplay();
}

// ==========================================
// Логіка Реплею
// ==========================================

function startReplay() {
    inReplayMode = true;
    fullGameHistory = game.history(); // Зберігаємо масив усіх ходів SAN
    replayIndex = 0;
    
    game.reset(); // Відкочуємо дошку в стартову позицію
    updateBoard();
    
    replayControls.style.display = 'flex';
    replayControls.classList.remove('hidden');
    replayNextBtn.style.visibility = 'hidden';
    replayText.innerText = 'Підготовка до розбору...';
    
    replayTimer = setTimeout(playNextReplayMove, 400); // Починаємо через долю секунди
}

function playNextReplayMove() {
    if (replayIndex >= fullGameHistory.length) {
        replayText.innerText = 'Розбір завершено!';
        replayNextBtn.style.visibility = 'hidden';
        inReplayMode = false;
        return;
    }
    
    // Робимо хід
    const moveSAN = fullGameHistory[replayIndex];
    const moveObj = game.move(moveSAN);
    updateBoard();
    
    const executedMoveRaw = moveObj.from + moveObj.to + (moveObj.promotion || '');

    const mark = moveClassifications[replayIndex];
    // Зупиняємось ТІЛЬКИ на грубих помилках або геніальних/чудових ходах
    // 🌟 (Просто хороший хід) пропускаємо без паузи!
    const isKey = ['💎', '🎯', '❓', '❌'].includes(mark);
    const justPlayedByPlayer = (game.turn() !== playerColor);
    const matchesDepth = (analyzeMode === 'all' || isKey);
    const matchesScope = (!analyzeOnlyPlayer || justPlayedByPlayer);
    
    if (matchesDepth && matchesScope) {
        pauseReplay(mark, moveSAN, analysisBestMoves[replayIndex], executedMoveRaw);
    } else {
        replayText.innerText = `Відтворення... (${moveSAN})`;
        replayTimer = setTimeout(playNextReplayMove, 400); // Швидке перемотування (0.4с)
    }
    
    replayIndex++;
}

function pauseReplay(mark, playedMove, bestMoveRaw, executedMoveRaw) {
    if (replayTimer) clearTimeout(replayTimer);
    replayNextBtn.style.visibility = 'visible';
    
    let moveDesc = '';
    switch (mark) {
        case '❌': moveDesc = 'Бландер (Зівок)'; break;
        case '❓': moveDesc = 'Помилка'; break;
        case '⁉️': moveDesc = 'Неточність'; break;
        case '✔️': moveDesc = 'Добрий хід'; break;
        case '👍': moveDesc = 'Відмінний хід'; break;
        case '🌟': moveDesc = 'Найкращий хід'; break;
        case '🎯': moveDesc = 'Чудовий хід'; break;
        case '💎': moveDesc = 'Геніальний хід'; break;
        default: moveDesc = 'Хід'; break;
    }

    let adviceText = '';
    const isError = ['❓', '❌', '⁉️'].includes(mark);
    const playedBest = bestMoveRaw && executedMoveRaw === bestMoveRaw;

    if (isError && !playedBest) {
        adviceText = `${mark} ${playedMove} - ${moveDesc}! Краще: ${bestMoveRaw || '?'}`;
    } else {
        adviceText = `${mark} ${playedMove} - ${moveDesc}.`;
    }
    replayText.innerText = adviceText;
    
    // Підсвічуємо ідеальний хід
    if (isError && bestMoveRaw && !playedBest) {
        highlightOptimalMove2D(bestMoveRaw);
        
        if (window.chess3D) {
            const hist = game.history({ verbose: true });
            window.chess3D.syncWithGameState(
                JSON.stringify(game.board()), 
                game.turn(), 
                [], 
                null, 
                game.in_check(), 
                hist,
                bestMoveRaw
            );
        }
    }
}

function highlightOptimalMove2D(bestMoveRaw) {
    const fromSq = bestMoveRaw.substring(0, 2);
    const toSq = bestMoveRaw.substring(2, 4);
    
    const fromEl = document.querySelector(`[data-square="${fromSq}"]`);
    const toEl = document.querySelector(`[data-square="${toSq}"]`);
    
    if (fromEl) fromEl.classList.add('optimal-move');
    if (toEl) toEl.classList.add('optimal-move');
}

function clearOptimalHighlights2D() {
    document.querySelectorAll('.optimal-move').forEach(sq => {
        sq.classList.remove('optimal-move');
    });
}

replayNextBtn.addEventListener('click', () => {
    replayNextBtn.style.visibility = 'hidden';
    clearOptimalHighlights2D();
    replayTimer = setTimeout(playNextReplayMove, 400);
});

const replayExitBtn = document.getElementById('replay-exit-btn');
if (replayExitBtn) {
    replayExitBtn.addEventListener('click', () => {
        resetGame();
    });
}

// Ініціалізація
createBoard();
