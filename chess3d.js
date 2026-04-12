class Chess3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        // Основні компоненти
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);
        
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        // Змінюємо позицію камери для повноекранного режиму (щоб дошка не була занадто великою)
        this.camera.position.set(0, 10, 15);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        window.addEventListener('resize', this.onWindowResize.bind(this));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        // Керування камерою (мишкою)
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2.1; // Не опускатися нижче дошки
        this.controls.minDistance = 5;
        this.controls.maxDistance = 20;
        
        this.setupLights();
        
        // Група для дошки (обертатиметься)
        this.boardGroup = new THREE.Group();
        this.scene.add(this.boardGroup);
        
        this.squareSize = 1;
        this.boardOffset = 3.5; // Щоб дошка була відцентрована (8 квадратів - 1) / 2
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.squareMeshes = {}; // squareId => Mesh
        this.pieceMeshes = {};  // squareId => Group/Mesh об'єкт фігури
        
        this.targetRotationY = 0;
        
        this.buildBoard();
        
        // Події
        this.renderer.domElement.addEventListener('pointerdown', this.onClick.bind(this));
        
        this.onSquareClickCallback = null;
        
        this.animate = this.animate.bind(this);
        this.animate();
    }
    
    setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
        
        const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.left = -6;
        dirLight.shadow.camera.right = 6;
        dirLight.shadow.camera.top = 6;
        dirLight.shadow.camera.bottom = -6;
        this.scene.add(dirLight);
    }
    
    buildBoard() {
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a });
        
        // База дошки (товщина)
        const baseGeo = new THREE.BoxGeometry(8, 0.5, 8);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = -0.25;
        baseMesh.receiveShadow = true;
        this.boardGroup.add(baseMesh);
        
        const files = 'abcdefgh';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const isDark = (row + col) % 2 !== 0;
                const mat = isDark ? darkMat : whiteMat;
                
                const geo = new THREE.BoxGeometry(1, 0.1, 1);
                const square = new THREE.Mesh(geo, mat);
                square.receiveShadow = true;
                
                // Координати X (від -3.5 до 3.5) та Z (від -3.5 до 3.5)
                // Для Z: row=0 це 8-ма лінія. Тому Z менше (або далі від камери). 
                const x = col - this.boardOffset;
                const z = row - this.boardOffset;
                
                square.position.set(x, 0.05, z);
                
                const id = files[col] + (8 - row);
                square.userData.squareId = id;
                square.userData.originalMat = mat;
                
                this.squareMeshes[id] = square;
                this.boardGroup.add(square);
            }
        }
    }
    
    // Створення геометричних фігур
    createPieceMesh(type, color) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({
            color: color === 'w' ? 0xffffff : 0x222222,
            roughness: 0.3,
            metalness: 0.1
        });
        
        // У кожної фігури є базова підставка
        const baseGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.2, 16);
        const base = new THREE.Mesh(baseGeo, mat);
        base.position.y = 0.1;
        base.castShadow = true;
        group.add(base);
        
        let bodyGeo, topGeo, body, top;
        switch(type) {
            case 'p': // Пішак
                bodyGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.5, 16);
                body = new THREE.Mesh(bodyGeo, mat);
                body.position.y = 0.45;
                group.add(body);
                
                topGeo = new THREE.SphereGeometry(0.18, 16, 16);
                top = new THREE.Mesh(topGeo, mat);
                top.position.y = 0.8;
                group.add(top);
                break;
                
            case 'r': // Тура
                bodyGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.8, 16);
                body = new THREE.Mesh(bodyGeo, mat);
                body.position.y = 0.6;
                group.add(body);
                // Корона (спрощена)
                topGeo = new THREE.CylinderGeometry(0.25, 0.2, 0.2, 16);
                top = new THREE.Mesh(topGeo, mat);
                top.position.y = 1.1;
                group.add(top);
                break;
                
            case 'n': // Кінь (Голова в один бік)
                bodyGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.6, 16);
                body = new THREE.Mesh(bodyGeo, mat);
                body.position.y = 0.5;
                group.add(body);
                
                topGeo = new THREE.BoxGeometry(0.2, 0.5, 0.4);
                top = new THREE.Mesh(topGeo, mat);
                top.position.set(0, 0.9, 0.1);
                top.rotation.x = -Math.PI / 6;
                group.add(top);
                break;
                
            case 'b': // Слон
                bodyGeo = new THREE.CylinderGeometry(0.12, 0.25, 0.9, 16);
                body = new THREE.Mesh(bodyGeo, mat);
                body.position.y = 0.65;
                group.add(body);
                
                topGeo = new THREE.ConeGeometry(0.15, 0.5, 16);
                top = new THREE.Mesh(topGeo, mat);
                top.position.y = 1.2;
                group.add(top);
                break;
                
            case 'q': // Королева
                bodyGeo = new THREE.CylinderGeometry(0.15, 0.3, 1.2, 16);
                body = new THREE.Mesh(bodyGeo, mat);
                body.position.y = 0.8;
                group.add(body);
                
                topGeo = new THREE.SphereGeometry(0.2, 16, 16);
                top = new THREE.Mesh(topGeo, mat);
                top.position.y = 1.5;
                group.add(top);
                break;
                
            case 'k': // Король
                bodyGeo = new THREE.CylinderGeometry(0.18, 0.3, 1.3, 16);
                body = new THREE.Mesh(bodyGeo, mat);
                body.position.y = 0.85;
                group.add(body);
                
                // Хрест
                topGeo = new THREE.BoxGeometry(0.08, 0.35, 0.08);
                top = new THREE.Mesh(topGeo, mat);
                top.position.y = 1.7;
                group.add(top);
                const cross2 = new THREE.BoxGeometry(0.25, 0.08, 0.08);
                const top2 = new THREE.Mesh(cross2, mat);
                top2.position.y = 1.7;
                group.add(top2);
                break;
        }
        
        // Налаштування тіней для всієї групи
        group.children.forEach(c => {
            c.castShadow = true;
            c.receiveShadow = true;
        });
        
        return group;
    }
    
    syncWithGameState(gameStateJSON, turn, possibleMoves, selectedSquare, inCheck, history, optimalMoveRaw) {
        const boardState = JSON.parse(gameStateJSON); // game.board() array
        
        // 1. Очистити старі фігури
        for (const id in this.pieceMeshes) {
            this.boardGroup.remove(this.pieceMeshes[id]);
        }
        this.pieceMeshes = {};
        
        // 2. Скинути підсвітки
        const highlightMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        const highlightDarkMat = new THREE.MeshStandardMaterial({ color: 0xcccc00 });
        const selectedMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const selectedNoMovesMat = new THREE.MeshStandardMaterial({ color: 0xffa500 });
        const checkMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
        const lastMoveMat = new THREE.MeshStandardMaterial({ color: 0xaaaa00, transparent: true, opacity: 0.5 });
        const optimalMat = new THREE.MeshStandardMaterial({ color: 0x2196F3, transparent: true, opacity: 0.6 });
        
        for (const id in this.squareMeshes) {
            this.squareMeshes[id].material = this.squareMeshes[id].userData.originalMat;
        }
        
        // 3. Розставити нові фігури
        const files = 'abcdefgh';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = boardState[row][col];
                const squareId = files[col] + (8 - row);
                const squareMesh = this.squareMeshes[squareId];
                
                if (piece) {
                    const pieceGroup = this.createPieceMesh(piece.type, piece.color);
                    // Координати фігури на дошці
                    pieceGroup.position.x = squareMesh.position.x;
                    pieceGroup.position.z = squareMesh.position.z;
                    // Обертаємо коня Білих/Чорних лицем один до одного
                    if (piece.type === 'n') {
                        pieceGroup.rotation.y = piece.color === 'w' ? 0 : Math.PI;
                    }
                    
                    this.boardGroup.add(pieceGroup);
                    this.pieceMeshes[squareId] = pieceGroup;
                    
                    // Шах підсвітка
                    if (inCheck && piece.type === 'k' && piece.color === turn) {
                        squareMesh.material = checkMat;
                    }
                }
            }
        }
        
        // 5. Підсвітка останнього ходу
        if (history && history.length > 0) {
            const lastMove = history[history.length - 1];
            if (this.squareMeshes[lastMove.from]) this.squareMeshes[lastMove.from].material = lastMoveMat;
            if (this.squareMeshes[lastMove.to]) this.squareMeshes[lastMove.to].material = lastMoveMat;
        }

        // 5.1 Підсвітка оптимального ходу
        if (optimalMoveRaw) {
            const bestFrom = optimalMoveRaw.substring(0, 2);
            const bestTo = optimalMoveRaw.substring(2, 4);
            if (this.squareMeshes[bestFrom]) this.squareMeshes[bestFrom].material = optimalMat;
            if (this.squareMeshes[bestTo]) this.squareMeshes[bestTo].material = optimalMat;
        }
        
        // 6. Підсвітка обраної фігури і можливих ходів перезаписує попередні
        if (selectedSquare && this.squareMeshes[selectedSquare]) {
            if (possibleMoves.length === 0) {
                this.squareMeshes[selectedSquare].material = selectedNoMovesMat;
            } else {
                this.squareMeshes[selectedSquare].material = selectedMat;
            }
        }
        
        possibleMoves.forEach(move => {
            const sqEl = this.squareMeshes[move.to];
            if (sqEl) {
                sqEl.material = (sqEl.userData.originalMat.color.getHex() === 0xeeeeee) 
                    ? highlightMat 
                    : highlightDarkMat;
            }
        });
        
        // Обертання дошки керується з chess.js updateBoardRotation()
    }
    
    onClick(event) {
        // Отримуємо координати кліку в -1 .. 1
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Перевіряємо зіткнення лише з квадратами (щоб легше клікати на полі)
        const intersects = this.raycaster.intersectObjects(Object.values(this.squareMeshes));
        
        if (intersects.length > 0) {
            const squareId = intersects[0].object.userData.squareId;
            if (this.onSquareClickCallback) {
                this.onSquareClickCallback(squareId);
            }
        }
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        
        this.controls.update();
        
        // Плавно крутимо групу дошки
        // Обираємо найкоротший шлях оберту
        let diff = this.targetRotationY - this.boardGroup.rotation.y;
        
        // Нормалізація до -PI .. PI
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        if (Math.abs(diff) > 0.01) {
            this.boardGroup.rotation.y += diff * 0.05; // Згладжування
        } else {
            this.boardGroup.rotation.y = this.targetRotationY;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Глобальний інстанс (зв'яжеться з chess.js)
window.chess3D = null;
