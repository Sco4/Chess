// auth.js

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    checkSavedAuth();

    document.getElementById('auth-submit-btn').addEventListener('click', handleAuth);
});

function checkSavedAuth() {
    const saved = localStorage.getItem('chess_auth');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.name && data.password) {
                // Швидка автоматична перевірка без вікна
                verifyUser(data.name, data.password, true);
                return;
            }
        } catch (e) {
            console.error(e);
        }
    }
    
    // Якщо немає збережених даних, показуємо вікно
    document.getElementById('auth-modal').classList.remove('hidden');
}

function handleAuth() {
    const name = document.getElementById('auth-name-input').value.trim();
    const password = document.getElementById('auth-password-input').value.trim();
    const remember = document.getElementById('auth-remember-checkbox').checked;

    if (!name || !password) {
        showAuthError("Будь ласка, введіть ім'я та пароль!");
        return;
    }
    
    // Перевіряємо довжину і допустимі символи (спрощено)
    if (name.length > 15) {
        showAuthError("Ім'я надто довге");
        return;
    }

    verifyUser(name, password, remember);
}

function verifyUser(name, password, remember) {
    const userRef = database.ref('users/' + name);
    
    userRef.once('value').then(snapshot => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.password === password) {
                loginSuccess(name, password, remember);
            } else {
                showAuthError("Неправильний пароль для цього імені!");
                document.getElementById('auth-modal').classList.remove('hidden');
            }
        } else {
            // Реєструємо нового
            userRef.set({
                password: password,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            }).then(() => {
                loginSuccess(name, password, remember);
            }).catch(err => {
                showAuthError("Помилка реєстрації. Перевірте підключення.");
                document.getElementById('auth-modal').classList.remove('hidden');
            });
        }
    }).catch(err => {
        showAuthError("Помилка бази даних.");
        document.getElementById('auth-modal').classList.remove('hidden');
    });
}

function loginSuccess(name, password, remember) {
    currentUser = name;
    
    if (remember) {
        localStorage.setItem('chess_auth', JSON.stringify({ name, password }));
    } else {
        localStorage.removeItem('chess_auth');
    }
    
    document.getElementById('auth-modal').classList.add('hidden');
    
    // Додаємо ім'я гравця до інтерфейсу
    document.getElementById('player-name-display').innerText = `Гравець: ${name}`;
}

function showAuthError(msg) {
    const errEl = document.getElementById('auth-error-msg');
    errEl.innerText = msg;
    errEl.classList.remove('hidden');
    setTimeout(() => errEl.classList.add('hidden'), 3000);
}
