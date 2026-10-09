class Mario {
    constructor(x, y, w, h) {
        this.w = w; 
        this.h = h;
        this.isGrounded = false;
        this.groundContacts = new Set();
        this.touchingLadder = false;
        this.ladderContacts = new Set();
        this.isClimbing = false;
        this.jumpBarrels = null;
        this.hammerTime = 0;
        this.facing = 1; // 1 = derecha, -1 = izquierda

        this.body = Bodies.rectangle(x, y, w, h, {
            inertia: Infinity,
            friction: 0.0,
            frictionStatic: 0.0,
            frictionAir: 0.01,
            restitution: 0.0,
            collisionFilter: {
                group: 0,
                category: CATEGORY_MARIO,
                mask: CATEGORY_DEFAULT | CATEGORY_PLATFORM | CATEGORY_BARREL | CATEGORY_LADDER | CATEGORY_FIRE
            }
        });

        World.add(world, this.body);
    }

    move(direction) {
        this.facing = direction;

        if (this.isClimbing) {
            this.setClimbing(false);
            Matter.Body.setPosition(this.body, {
                x: this.body.position.x + (direction * 4),
                y: this.body.position.y - 6
            });
        }

        const speed = 3.5;
        Matter.Body.setVelocity(this.body, {
            x: direction * speed,
            y: this.body.velocity.y
        });
    }

    setClimbing(climbingState) {
        this.isClimbing = climbingState;
        this.body.isSensor = climbingState;

        if (!climbingState) {
            // Empuje hacia arriba al salir de la escalera para evitar atravesar el suelo
            Matter.Body.setPosition(this.body, {
                x: this.body.position.x,
                y: this.body.position.y - 4
            });
        }

        if (climbingState) {
            this.jumpBarrels = null;
            this.groundContacts.clear();
            this.isGrounded = false;
            Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
        }
    }

    climb(direction) {
        if (this.hammerTime > 0) return;
        if (!this.touchingLadder) return;

        if (!this.isClimbing) {
            this.setClimbing(true);
        }

        const climbSpeed = 3.0;
        Matter.Body.setPosition(this.body, {
            x: this.body.position.x,
            y: this.body.position.y + (direction * climbSpeed)
        });

        Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
    }

    stopClimbing() {
        if (!this.touchingLadder) this.setClimbing(false);
        if (this.isClimbing) {
            Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
        }
    }

    stop() {
        if (!this.isClimbing) {
            Matter.Body.setVelocity(this.body, {
                x: this.body.velocity.x * 0.5,
                y: this.body.velocity.y
            });
        } else {
            Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
        }
    }

    jump() {
        if (this.isGrounded && !this.isClimbing && this.hammerTime === 0) {
            this.jumpBarrels = new Map(barrels.map(barrel => [barrel, {
                side: Math.sign(this.body.position.x - barrel.body.position.x), crossed: false
            }]));
            Matter.Body.setVelocity(this.body, {
                x: this.body.velocity.x,
                y: -5.2
            });
            this.isGrounded = false;
            this.groundContacts.clear();
        }
    }

    updateJumpScore() {
        if (!this.jumpBarrels) return;
        for (const [barrel, jump] of this.jumpBarrels) {
            if (!barrels.includes(barrel) || barrel.jumpScored) continue;
            const dx = this.body.position.x - barrel.body.position.x;
            if (Math.abs(dx) <= this.w / 2 + barrel.r &&
                this.body.bounds.max.y < barrel.body.bounds.min.y &&
                barrel.body.bounds.min.y - this.body.bounds.max.y <= this.h &&
                jump.side !== 0 && Math.sign(dx) === -jump.side) {
                jump.crossed = true;
            }
            if (this.isGrounded && jump.crossed) {
                barrel.jumpScored = true;
                score += 100;
            }
        }
        if (this.isGrounded) this.jumpBarrels = null;
    }

    hammerHead() {
        const overhead = Math.floor(engine.timing.timestamp / 200) % 2 === 1;
        return { 
            x: this.body.position.x + (overhead ? 0 : this.facing * 27),
            y: this.body.position.y - (overhead ? 34 : 8) 
        };
    }

    show() {
        push();
        translate(this.body.position.x, this.body.position.y);
        imageMode(CENTER);
        scale(this.facing, 1);

        if (marioImg) {
            noSmooth(); // Mantiene el pixel art nítido

            // Definir matriz exacta de la imagen suministrada (8 columnas x 4 filas)
            let cols = 8;
            let rows = 4;
            let cellW = marioImg.width / cols;
            let cellH = marioImg.height / rows;

            let col = 0;
            let row = 0;
            let offsetY = 20;

            // Seleccionar frame exacto según el estado físico
            if (gameState === "DYING") {
                row = 3; // Fila inferior de colapso/muerte
                offsetY = -30;
                col = Math.floor(millis() / 250) % 4;
            } else if (this.hammerTime > 0) {
                row = 2; // Fila de martillo
                offsetY = -30; 
                let hammerFrames = [5, 6]; 
                col = hammerFrames[Math.floor(millis() / 200) % hammerFrames.length];
            } else if (this.isClimbing) {
                row = 1; // Fila de escaleras
                col = Math.floor(millis()) % 2;
            } else if (!this.isGrounded) {
                row = 0;
                col = 6; // Frame de salto
            } else if (Math.abs(this.body.velocity.x) > 0.5) {
                row = 0; // Fila superior de movimiento
                let runFrames = [4, 5, 6];
                col = runFrames[Math.floor(millis() / 100) % runFrames.length];
            } else {
                row = 0;
                col = 4; // Frame estático (Idle)
            }

            let sx = col * cellW;
            let sy = row * cellH;
            image(marioImg, 0, offsetY, 52, 90, sx, sy, cellW, cellH);

        } else {
            rectMode(CENTER);
            fill(225, 40, 40);
            rect(0, 0, this.w, this.h);
        }

        pop();
    }
}
