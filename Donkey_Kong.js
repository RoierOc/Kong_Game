// --- CATEGORÍAS DE COLISIÓN (Máscaras de bits para Matter.js) ---
const CATEGORY_DEFAULT = 0x0001;   // Paredes y Límites
const CATEGORY_PLATFORM = 0x0002;  // Plataformas
const CATEGORY_BARREL = 0x0004;    // Barriles
const CATEGORY_MARIO = 0x0008;     // Mario
const CATEGORY_LADDER = 0x0010;    // Escaleras
const CATEGORY_FIRE = 0x0020;      // Fuego

const { Engine, World, Bodies } = Matter;

let engine, world;
let mario;
let platforms = [];
let ladders = [];
let barrels = [];
let fireballs = [];
let hammers = [];

// --- SISTEMA DE PUNTOS, VIDAS Y ESTADOS DE JUEGO ---
let currentLevel = 1;
const maxLevels = 3;
let score = 0;
let lives = 3;
let gameState = "START"; // "START", "PLAYING", "DYING", "WIN_LEVEL", "GAME_OVER", "GAME_CLEAR"
let respawnAt = 0;
let bonus = 5000;
let bonusElapsed = 0;
let difficulty = 1;
let menu, gameCanvas;
let menuPage = "main";

let goal;
let oilDrum;
const kong = { x: 80, y: 52 };
let lastBarrelTime = 0;
let barrelInterval = 3200;

let marioImg; 
let kongImg, princessImg, oilImg;

function loadMarioImage() {
    // Carga aquí la ruta o URL de tu imagen o sprite
    // Puedes usar URLs directas o rutas locales (ej: 'assets/mario.png')
    loadImage('https://preview.redd.it/smb1-mario-in-his-donkey-kong-colors-v0-5m5hkqsvnqcf1.png?auto=webp&s=c4d31b7d3cfd90c35672ff596b136762ddaf8d55',
        loaded => { marioImg = loaded; }, () => { marioImg = null; });
}
function setup() {
    const canvas = createCanvas(540, 760);
    canvas.parent('game');
    gameCanvas = canvas.elt;
    gameCanvas.setAttribute('tabindex', '-1');
    gameCanvas.setAttribute('aria-label', 'Tablero: flechas para moverse y espacio para saltar');
    setupMenu();
    loadMarioImage();
    loadImage('assets/donkey-kong.png', img => { kongImg = img; }, () => { kongImg = null; });
    loadImage('assets/princess.png', img => { princessImg = img; }, () => { princessImg = null; });
    loadImage('assets/oil.png', img => { oilImg = img; }, () => { oilImg = null; });

    engine = Engine.create();
    world = engine.world;

    // Inicializar primer nivel
    loadLevel(currentLevel);

    // --- DETECCIÓN DE IMPACTOS Y EVENTOS ---
    Matter.Events.on(engine, 'collisionStart', (event) => {
        for (let pair of event.pairs) {
            if (gameState !== "PLAYING") continue;
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            const barrel = bodyA.isBarrel ? bodyA : (bodyB.isBarrel ? bodyB : null);
            const ladder = bodyA.isLadder ? bodyA : (bodyB.isLadder ? bodyB : null);
            const fire = bodyA.isFireball ? bodyA : (bodyB.isFireball ? bodyB : null);
            if (barrel && (bodyA === oilDrum || bodyB === oilDrum)) {
                consumeBarrelAtOilDrum(barrel);
            }

            // 1. EL FUEGO DESTRUYE EL BARRIL Y DA PUNTOS (+100)
            if (barrel && fire) {
                destroyBarrel(barrel, 100);
            }

            // 2. CONDICIÓN DE VICTORIA (Mario llega al final de la última escalera)
            const isMarioGoal = (bodyA === mario.body && bodyB === goal) || (bodyB === mario.body && bodyA === goal);
            if (isMarioGoal && gameState === "PLAYING") {
                score += 500 + bonus; // Premio del nivel y tiempo restante
                if (currentLevel < maxLevels) {
                    gameState = "WIN_LEVEL";
                } else {
                    gameState = "GAME_CLEAR"; // Ganó los 3 niveles
                }
            }

            // 3. CAÍDA DE BARRILES POR ESCALERAS
            if (barrel && ladder) {
                const barrelObj = barrels.find(b => b.body === barrel);

                if (barrelObj && barrelObj.lastLadderTouched !== ladder && !barrelObj.isFallingLadder) {
                    barrelObj.lastLadderTouched = ladder;

                    let ladderDropChance = 0.35 + (currentLevel * 0.10);
                    if (random(1) < ladderDropChance) {
                        barrelObj.isFallingLadder = true;
                        barrelObj.ladderYTarget = barrel.position.y + 75; 

                        barrel.collisionFilter.mask = CATEGORY_DEFAULT | CATEGORY_MARIO | CATEGORY_LADDER | CATEGORY_FIRE;

                        Matter.Body.setPosition(barrel, {
                            x: ladder.position.x,
                            y: barrel.position.y + 6
                        });
                        Matter.Body.setVelocity(barrel, { x: 0, y: 3.5 });
                    }
                }
            }

            // 4. COLISIONES DE MARIO (Pérdida de Vida)
            const isA = bodyA === mario.body;
            const isB = bodyB === mario.body;
            const otherBody = isA ? bodyB : (isB ? bodyA : null);

            if (otherBody) {
                if (otherBody.isHammer && mario.hammerTime === 0 && !mario.isClimbing) {
                    mario.hammerTime = 8000;
                    mario.jumpBarrels = null;
                    World.remove(world, otherBody);
                    hammers.splice(hammers.indexOf(otherBody), 1);
                }
                const landedOnTop = isA ? pair.collision.normal.y < -0.5 : pair.collision.normal.y > 0.5;
                if (otherBody.isPlatform && landedOnTop && !mario.isClimbing) {
                    mario.groundContacts.add(otherBody);
                    mario.isGrounded = true;
                }
                if (otherBody.isLadder) {
                    mario.ladderContacts.add(otherBody);
                    mario.touchingLadder = true;
                }
                if (otherBody.isBarrel || otherBody.isFireball) {
                    console.log("¡Mario fue golpeado!");
                    playerDied();
                }
            }
        }
    });

    Matter.Events.on(engine, 'collisionEnd', (event) => {
        for (let pair of event.pairs) {
            const isA = pair.bodyA === mario.body;
            const isB = pair.bodyB === mario.body;
            const otherBody = isA ? pair.bodyB : (isB ? pair.bodyA : null);

            if (otherBody) {
                if (otherBody.isPlatform) {
                    mario.groundContacts.delete(otherBody);
                    mario.isGrounded = mario.groundContacts.size > 0;
                }
                if (otherBody.isLadder) {
                    mario.ladderContacts.delete(otherBody);
                    mario.touchingLadder = mario.ladderContacts.size > 0;
                }
            }
        }
    });
}

function destroyBarrel(body, points) {
    const index = barrels.findIndex(b => b.body === body);
    if (index === -1) return;
    barrels[index].removeFromWorld();
    barrels.splice(index, 1);
    score += points;
}

// --- MANEJO DE PÉRDIDA DE VIDAS ---
function consumeBarrelAtOilDrum(body) {
    if (!barrels.some(barrel => barrel.body === body)) return;
    destroyBarrel(body, 0);
    if (fireballs.length < currentLevel + 1) {
        fireballs.push(new Fireball(oilDrum.position.x, oilDrum.position.y - 28, 10));
    }
}

function playerDied() {
    if (gameState !== "PLAYING") return;
    lives--;
    if (lives > 0) {
        // Reaparecer al inicio del nivel actual
        gameState = "DYING";
        respawnAt = millis() + 500;
    } else {
        // Te quedaste sin vidas -> Game Over
        gameState = "GAME_OVER";
    }
}

// --- CARGADOR DE NIVELES ---
function loadLevel(level) {
    World.clear(world, false);
    Engine.clear(engine);
    lastBarrelTime = millis();
    bonus = 5000;
    bonusElapsed = 0;
    
    platforms = [];
    ladders = [];
    barrels = [];
    fireballs = [];
    hammers = [Bodies.rectangle(180, 585, 22, 26, {
        isStatic: true, isSensor: true, isHammer: true,
        collisionFilter: { group: 0, category: CATEGORY_DEFAULT, mask: CATEGORY_MARIO }
    }), Bodies.rectangle(360, 247, 22, 26, {
        isStatic: true, isSensor: true, isHammer: true,
        collisionFilter: { group: 0, category: CATEGORY_DEFAULT, mask: CATEGORY_MARIO }
    })];
    World.add(world, hammers);

    mario = new Mario(60, 690, 24, 34);

    const wallLeft = Bodies.rectangle(-10, height / 2, 20, height, { isStatic: true, collisionFilter: { group: 0, category: CATEGORY_DEFAULT, mask: 0xFFFF } });
    const wallRight = Bodies.rectangle(width + 10, height / 2, 20, height, { isStatic: true, collisionFilter: { group: 0, category: CATEGORY_DEFAULT, mask: 0xFFFF } });
    World.add(world, [wallLeft, wallRight]);

    // Punto exacto de meta en el final de la última escalera (X: 220, Y: 55)
    goal = Bodies.rectangle(220, 55, 30, 20, { isStatic: true, isSensor: true });
    World.add(world, goal);
    oilDrum = Bodies.rectangle(28, 692, 32, 36, {
        isStatic: true, isSensor: true,
        collisionFilter: { group: 0, category: CATEGORY_FIRE, mask: CATEGORY_BARREL }
    });
    World.add(world, oilDrum);

    const pWidth = 460;
    const pHeight = 16;
    const slope = radians(4.5);

    // Plataformas
    platforms.push(new Platform(270, 720, 540, pHeight, 0));
    platforms.push(new Platform(230, 610, pWidth, pHeight, slope));
    platforms.push(new Platform(310, 500, pWidth, pHeight, -slope));
    platforms.push(new Platform(230, 390, pWidth, pHeight, slope));
    platforms.push(new Platform(310, 280, pWidth, pHeight, -slope));
    platforms.push(new Platform(230, 170, pWidth, pHeight, slope));
    platforms.push(new Platform(180, 80, 280, pHeight, -slope));

    // Escaleras
    ladders.push(new Ladder(430, 20, platforms[1], platforms[0]));
    ladders.push(new Ladder(110, 20, platforms[2], platforms[1]));
    ladders.push(new Ladder(430, 20, platforms[3], platforms[2]));
    ladders.push(new Ladder(110, 20, platforms[4], platforms[3]));
    ladders.push(new Ladder(430, 20, platforms[5], platforms[4]));
    ladders.push(new Ladder(220, 20, platforms[6], platforms[5]));

    // Escaleras parciales / trampas
    ladders.push(new Ladder(270, 20, null, platforms[1]));
    ladders.push(new Ladder(270, 20, null, platforms[3]));
    ladders.push(new Ladder(300, 20, null, platforms[4]));

    // DIFICULTAD
    if (level === 1) {
        barrelInterval = 3200;
        fireballs.push(new Fireball(120, 600, 10));
    } else if (level === 2) {
        barrelInterval = 2400;
        fireballs.push(new Fireball(120, 600, 10));
        fireballs.push(new Fireball(380, 380, 10));
    } else if (level === 3) {
        barrelInterval = 1700;
        fireballs.push(new Fireball(120, 600, 10));
        fireballs.push(new Fireball(380, 380, 10));
        fireballs.push(new Fireball(200, 270, 10));
    }
    barrelInterval /= difficulty;
}

function draw() {
    background(10, 10, 15);
    drawDonkeyKong();
    if (gameState === "DYING" && millis() >= respawnAt) {
        loadLevel(currentLevel);
        gameState = "PLAYING";
    }

    drawPauline();

    if (gameState === "PLAYING") {
        bonusElapsed += deltaTime;
        const ticks = Math.floor(bonusElapsed / 2000);
        bonusElapsed %= 2000;
        bonus = Math.max(0, bonus - ticks * 100);
        if (bonus === 0) playerDied();
    }
    if (gameState === "PLAYING") {
        mario.hammerTime = Math.max(0, mario.hammerTime - deltaTime);
        if (mario.hammerTime > 0) {
            const head = mario.hammerHead();
            const bounds = { min: { x: head.x - 12, y: head.y - 8 },
                max: { x: head.x + 12, y: head.y + 8 } };
            for (const barrel of [...barrels]) {
                if (Matter.Bounds.overlaps(bounds, barrel.body.bounds)) destroyBarrel(barrel.body, 300);
            }
            for (let i = fireballs.length - 1; i >= 0; i--) {
                if (Matter.Bounds.overlaps(bounds, fireballs[i].body.bounds)) {
                    fireballs[i].removeFromWorld();
                    fireballs.splice(i, 1);
                    score += 300;
                }
            }
        }
        if (mario.isClimbing) {
            mario.body.force.y -= mario.body.mass * world.gravity.y * world.gravity.scale;
        }
        Engine.update(engine);
        if (gameState === "PLAYING") {
            mario.updateJumpScore();
            for (let barrel of barrels) barrel.updateLadderFall();
            for (let fire of fireballs) fire.update();
        }
        if (mario.body.position.y > height + 40) playerDied();

        if (gameState === "PLAYING" && millis() - lastBarrelTime > barrelInterval) {
            barrels.push(new Barrel(kong.x + 38, kong.y + 12, 12));
            lastBarrelTime = millis();
        }
    }

    // Renderizar Entidades
    for (let i = barrels.length - 1; i >= 0; i--) {
        barrels[i].show();
        if (gameState === "PLAYING" && barrels[i].isOffscreen()) {
            destroyBarrel(barrels[i].body, 0);
        }
    }

    for (let fire of fireballs) fire.show();
    for (let platform of platforms) platform.show();
    for (let ladder of ladders) ladder.show();
    for (const hammer of hammers) drawHammer(hammer.position.x, hammer.position.y);
    mario.show();
    drawOilDrum();

    // --- INTERFAZ DE USUARIO / HUD (PUNTOS Y VIDAS) ---
    push();
    fill(255);
    textSize(16);
    textFont('monospace');
    textAlign(LEFT, TOP);
    stroke(0);
    strokeWeight(3);
    text(`NIVEL: ${currentLevel}`, 12, 738);
    text(`PUNTOS: ${score}`, 160, 738);
    textSize(16);
    text(`BONO: ${bonus}`, 360, 46);
    textSize(16);
    fill(255, 50, 50);
    text(`VIDAS: ${"♥ ".repeat(lives)}`, 380, 738);
    if (mario.hammerTime > 0) {
        fill(255, 215, 0);
        textSize(14);
        text(`MARTILLO: ${Math.ceil(mario.hammerTime / 1000)} s`, 360, 70);
    }
    pop();

    // Controles de Mario
    if (gameState === "PLAYING") {
        let isClimbingPressed = false;

        if (keyIsDown(UP_ARROW) && mario.touchingLadder && mario.hammerTime === 0) {
            isClimbingPressed = mario.climb(-1);
        } else if (keyIsDown(DOWN_ARROW) && mario.touchingLadder && mario.hammerTime === 0) {
            isClimbingPressed = mario.climb(1);
        }

        if (!isClimbingPressed) {
            if (mario.isClimbing) mario.stopClimbing();

            if (keyIsDown(RIGHT_ARROW)) mario.move(1);
            else if (keyIsDown(LEFT_ARROW)) mario.move(-1);
            else mario.stop();
        }
    } 
    // OVERLAYS / MENÚS DE ESTADO
    else if (gameState === "WIN_LEVEL") {
        showOverlay(`¡NIVEL ${currentLevel} COMPLETADO!`, "Presiona ENTER para el siguiente nivel", `Puntaje actual: ${score}`);
    } 
    else if (gameState === "GAME_OVER") {
        showOverlay("¡GAME OVER!", "Presiona 'R' para volver al Nivel 1", `Puntaje Final: ${score}`);
    }
    else if (gameState === "DYING") {
        showOverlay("¡GOLPEADO!", "Reiniciando el tablero");
    }
    else if (gameState === "GAME_CLEAR") {
        showOverlay("¡JUEGO COMPLETADO!", "Presiona 'R' para jugar de nuevo", `Puntaje Final: ${score}`);
    }
}

function drawOilDrum() {
    push();
    translate(oilDrum.position.x, oilDrum.position.y);
    if (oilImg) {
        noSmooth();
        imageMode(CENTER);
        image(oilImg, 0, -13, 32, 62);
        pop();
        return;
    }
    rectMode(CENTER);
    fill(35, 80, 160);
    stroke(120, 190, 255);
    rect(0, 0, 32, 36);
    noStroke();
    fill(255, 90, 0);
    triangle(-14, -18, 0, -40, 14, -18);
    fill(255, 220, 60);
    triangle(-7, -18, 0, -32, 7, -18);
    fill(255);
    textSize(12);
    textAlign(CENTER, CENTER);
    text('OIL', 0, 2);
    pop();
}

function drawHammer(x, y) {
    push();
    rectMode(CENTER);
    noStroke();
    fill(180, 110, 45);
    rect(x, y + 12, 5, 24);
    fill(220);
    rect(x, y, 24, 16);
    pop();
}

function drawDonkeyKong() {
    push();
    translate(kong.x, kong.y);
    if (kongImg) {
        noSmooth();
        imageMode(CENTER);
        image(kongImg, 0, 0, 72, 54);
        pop();
        return;
    }
    rectMode(CENTER);
    noStroke();
    fill(120, 65, 30);
    rect(0, 5, 38, 40);
    rect(-25, 8, 16, 32);
    rect(25, 8, 16, 32);
    rect(-12, 25, 18, 10);
    rect(12, 25, 18, 10);
    fill(220, 165, 100);
    rect(0, -10, 26, 22);
    rect(0, 12, 22, 16);
    fill(0);
    rect(-6, -14, 4, 4);
    rect(6, -14, 4, 4);
    rect(0, -3, 14, 3);
    pop();
}

function drawPauline() {
    push();
    imageMode(CENTER);
    if (princessImg) {
        noSmooth();
        image(princessImg, goal.position.x, goal.position.y - 4, 24, 40);
    } else {
        noStroke();
        fill(255, 105, 180);
        triangle(goal.position.x, goal.position.y - 8,
            goal.position.x - 10, goal.position.y + 16,
            goal.position.x + 10, goal.position.y + 16);
        fill(255, 210, 170);
        rectMode(CENTER);
        rect(goal.position.x, goal.position.y - 13, 10, 10);
        fill(160, 70, 30);
        rect(goal.position.x, goal.position.y - 20, 12, 5);
    }
    fill(255, 0, 80);
    textAlign(CENTER, CENTER);
    textSize(16);
    text("♥", goal.position.x + 18, goal.position.y - 12);
    pop();
}

function showOverlay(title, subtitle, extraInfo = "") {
    push();
    rectMode(CORNER);
    fill(0, 0, 0, 200);
    rect(0, 0, width, height);

    textAlign(CENTER, CENTER);
    textSize(28);
    stroke(0);
    strokeWeight(4);
    fill(255, 215, 0);
    text(title, width / 2, height / 2 - 40);

    textSize(20);
    fill(255);
    text(extraInfo, width / 2, height / 2 + 5);

    textSize(16);
    fill(200);
    text(subtitle, width / 2, height / 2 + 50);
    pop();
}

function setupMenu() {
    menu = document.getElementById('game-menu');
    document.getElementById('play').onclick = startGame;
    document.getElementById('controls-open').onclick = () => showMenu('controls');
    document.getElementById('settings-open').onclick = () => showMenu('settings');
    document.getElementById('controls-back').onclick = () => showMenu('main');
    document.getElementById('settings-back').onclick = () => showMenu('main');
    const fullscreen = document.getElementById('fullscreen');
    fullscreen.disabled = !document.fullscreenEnabled;
    fullscreen.onclick = toggleFullscreen;
    if (fullscreen.disabled) document.getElementById('settings-status').textContent = 'Pantalla completa no disponible en este navegador.';
    document.addEventListener('fullscreenchange', () => {
        fullscreen.textContent = document.fullscreenElement ? 'SALIR DE PANTALLA COMPLETA' : 'PANTALLA COMPLETA';
    });
    menu.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            showMenu('main');
            event.preventDefault();
        }
        if (!['ArrowUp', 'ArrowDown', 'Tab'].includes(event.key)) return;
        if (event.target.tagName === 'SELECT' && event.key !== 'Tab') return;
        const items = [...menu.querySelector(`[data-panel="${menuPage}"]`).querySelectorAll('button:not(:disabled), select')];
        const direction = event.key === 'ArrowUp' || event.shiftKey ? -1 : 1;
        const next = (items.indexOf(document.activeElement) + direction + items.length) % items.length;
        items[next].focus();
        event.preventDefault();
    });
    showMenu('main');
}

function showMenu(page) {
    menuPage = page;
    menu.hidden = false;
    gameCanvas.setAttribute('tabindex', '-1');
    for (const panel of menu.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== page;
    document.getElementById('menu-title').textContent = page === 'main' ? 'DONKEY KONG' : page === 'controls' ? 'CONTROLES' : 'CONFIGURACIÓN';
    document.getElementById(page === 'main' ? 'play' : page === 'controls' ? 'controls-back' : 'difficulty').focus();
}

async function toggleFullscreen() {
    const status = document.getElementById('settings-status');
    try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
        status.textContent = '';
    } catch {
        status.textContent = 'No se pudo cambiar la pantalla completa. Inténtalo de nuevo.';
    }
}

function startGame() {
    const selected = Number(document.getElementById('difficulty').value);
    difficulty = [0.8, 1, 1.2].includes(selected) ? selected : 1;
    currentLevel = 1;
    lives = 3;
    score = 0;
    loadLevel(currentLevel);
    gameState = "PLAYING";
    menu.hidden = true;
    gameCanvas.setAttribute('tabindex', '0');
    gameCanvas.focus();
}

function keyPressed() {
    if (gameState === "START") {
        if (keyCode === ENTER && document.activeElement.tagName !== 'SELECT') {
            if (document.activeElement.tagName === 'BUTTON') document.activeElement.click();
            else if (menuPage === 'main') startGame();
            return false;
        }
        return;
    }
    if (keyCode === 32 && gameState === "PLAYING") { // ESPACIO
        mario.jump();
    }

    // Avanzar de nivel con ENTER
    if (keyCode === ENTER && gameState === "WIN_LEVEL") {
        currentLevel++;
        gameState = "PLAYING";
        loadLevel(currentLevel);
    }

    // Reiniciar desde el Nivel 1 si pierdes todas las vidas o completas el juego
    if ((key === 'r' || key === 'R') && (gameState === "GAME_OVER" || gameState === "GAME_CLEAR")) {
        startGame();
    }
    if ([32, ENTER, LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) return false;
}
