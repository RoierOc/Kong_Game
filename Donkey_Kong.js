// --- CATEGORÍAS DE COLISIÓN (Máscaras de bits para Matter.js) ---
const CATEGORY_DEFAULT = 0x0001;   // Paredes y Límites
const CATEGORY_PLATFORM = 0x0002;  // Plataformas
const CATEGORY_BARREL = 0x0004;    // Barriles
const CATEGORY_MARIO = 0x0008;     // Mario
const CATEGORY_LADDER = 0x0010;    // Escaleras
const CATEGORY_FIRE = 0x0020;      // Fuego

const { Engine, World, Bodies, Mouse, MouseConstraint } = Matter;

let engine, world, mc;
let mario;
let platforms = [];
let ladders = [];
let barrels = [];
let fireballs = [];

// --- SISTEMA DE PUNTOS, VIDAS Y ESTADOS DE JUEGO ---
let currentLevel = 1;
const maxLevels = 3;
let score = 0;
let lives = 3;
let gameState = "PLAYING"; // "PLAYING", "WIN_LEVEL", "GAME_OVER", "GAME_CLEAR"

let goal;
let lastBarrelTime = 0;
let barrelInterval = 3200;

let marioImg; 

function preload() {
    // Carga aquí la ruta o URL de tu imagen o sprite
    // Puedes usar URLs directas o rutas locales (ej: 'assets/mario.png')
    marioImg = loadImage('https://preview.redd.it/smb1-mario-in-his-donkey-kong-colors-v0-5m5hkqsvnqcf1.png?auto=webp&s=c4d31b7d3cfd90c35672ff596b136762ddaf8d55');
}
function setup() {
    const canvas = createCanvas(540, 760);

    engine = Engine.create();
    world = engine.world;

    const mouse = Mouse.create(canvas.elt);
    mouse.pixelRatio = pixelDensity();

    mc = MouseConstraint.create(engine, { mouse: mouse });
    World.add(world, mc);

    // Inicializar primer nivel
    loadLevel(currentLevel);

    // --- DETECCIÓN DE IMPACTOS Y EVENTOS ---
    Matter.Events.on(engine, 'collisionStart', (event) => {
        for (let pair of event.pairs) {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            const barrel = bodyA.isBarrel ? bodyA : (bodyB.isBarrel ? bodyB : null);
            const ladder = bodyA.isLadder ? bodyA : (bodyB.isLadder ? bodyB : null);
            const fire = bodyA.isFireball ? bodyA : (bodyB.isFireball ? bodyB : null);

            // 1. EL FUEGO DESTRUYE EL BARRIL Y DA PUNTOS (+100)
            if (barrel && fire) {
                const barrelIndex = barrels.findIndex(b => b.body === barrel);
                if (barrelIndex !== -1) {
                    barrels[barrelIndex].removeFromWorld();
                    barrels.splice(barrelIndex, 1);
                    score += 100; // Puntos adicionales
                    console.log("¡El fuego destruyó un barril! +100 PTS");
                }
            }

            // 2. CONDICIÓN DE VICTORIA (Mario llega al final de la última escalera)
            const isMarioGoal = (bodyA === mario.body && bodyB === goal) || (bodyB === mario.body && bodyA === goal);
            if (isMarioGoal && gameState === "PLAYING") {
                score += 500; // Bonificación por superar el nivel
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

// --- MANEJO DE PÉRDIDA DE VIDAS ---
function playerDied() {
    lives--;
    if (lives > 0) {
        // Reaparecer al inicio del nivel actual
        Matter.Body.setPosition(mario.body, { x: 60, y: 690 });
        Matter.Body.setVelocity(mario.body, { x: 0, y: 0 });
    } else {
        // Te quedaste sin vidas -> Game Over
        gameState = "GAME_OVER";
    }
}

// --- CARGADOR DE NIVELES ---
function loadLevel(level) {
    World.clear(world, false);
    
    platforms = [];
    ladders = [];
    barrels = [];
    fireballs = [];

    mario = new Mario(60, 690, 24, 34);

    const wallLeft = Bodies.rectangle(-10, height / 2, 20, height, { isStatic: true, collisionFilter: { group: 0, category: CATEGORY_DEFAULT, mask: 0xFFFF } });
    const wallRight = Bodies.rectangle(width + 10, height / 2, 20, height, { isStatic: true, collisionFilter: { group: 0, category: CATEGORY_DEFAULT, mask: 0xFFFF } });
    World.add(world, [wallLeft, wallRight]);

    // Punto exacto de meta en el final de la última escalera (X: 220, Y: 55)
    goal = Bodies.rectangle(220, 55, 30, 20, { isStatic: true, isSensor: true });
    World.add(world, goal);

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
    ladders.push(new Ladder(430, 655, 20, 110));
    ladders.push(new Ladder(110, 545, 20, 110));
    ladders.push(new Ladder(430, 435, 20, 110));
    ladders.push(new Ladder(110, 325, 20, 110));
    ladders.push(new Ladder(430, 215, 20, 110));
    ladders.push(new Ladder(220, 115, 20, 110)); // Última escalera

    // Escaleras parciales / trampas
    ladders.push(new Ladder(270, 560, 20, 65));
    ladders.push(new Ladder(270, 345, 20, 65));
    ladders.push(new Ladder(300, 235, 20, 65));

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
}

function draw() {
    background(10, 10, 15);

    // Renderizar Meta (Corazón rosa al final)
    push();
    fill(255, 105, 180);
    noStroke();
    rectMode(CENTER);
    rect(goal.position.x, goal.position.y, 20, 10);
    fill(255, 0, 80);
    textAlign(CENTER, CENTER);
    textSize(16);
    text("♥", goal.position.x, goal.position.y - 15);
    pop();

    if (gameState === "PLAYING") {
        Engine.update(engine);

        if (millis() - lastBarrelTime > barrelInterval) {
            barrels.push(new Barrel(100, 60, 12));
            lastBarrelTime = millis();
        }
    }

    // Renderizar Entidades
    for (let i = barrels.length - 1; i >= 0; i--) {
        barrels[i].show();
        if (barrels[i].isOffscreen()) {
            barrels[i].removeFromWorld();
            barrels.splice(i, 1);
        }
    }

    for (let fire of fireballs) fire.show();
    for (let platform of platforms) platform.show();
    for (let ladder of ladders) ladder.show();
    mario.show();

    // --- INTERFAZ DE USUARIO / HUD (PUNTOS Y VIDAS) ---
    push();
    fill(255);
    textSize(18);
    textFont('monospace');
    textAlign(LEFT, TOP);
    stroke(0);
    strokeWeight(3);
    text(`NIVEL: ${currentLevel}`, 20, 20);
    text(`PUNTOS: ${score}`, 180, 20);
    fill(255, 50, 50);
    text(`VIDAS: ${"♥ ".repeat(lives)}`, 380, 20);
    pop();

    // Controles de Mario
    if (gameState === "PLAYING") {
        let isClimbingPressed = false;

        if (keyIsDown(UP_ARROW) && mario.touchingLadder) {
            mario.climb(-1);
            isClimbingPressed = true;
        } else if (keyIsDown(DOWN_ARROW) && mario.touchingLadder) {
            mario.climb(1);
            isClimbingPressed = true;
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
    else if (gameState === "GAME_CLEAR") {
        showOverlay("¡JUEGO COMPLETADO!", "Presiona 'R' para jugar de nuevo", `Puntaje Final: ${score}`);
    }
}

function showOverlay(title, subtitle, extraInfo = "") {
    push();
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

function keyPressed() {
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
        currentLevel = 1;
        lives = 3;
        score = 0;
        gameState = "PLAYING";
        loadLevel(currentLevel);
    }
}
