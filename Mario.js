class Mario {
    constructor(x, y, w, h) {
        this.w = w;
        this.h = h;
        this.isGrounded = false;
        this.groundContacts = new Set();
        this.touchingLadder = false;
        this.ladderContacts = new Set();
        this.isClimbing = false;
        this.climbingLadder = null;
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
        this.facing = direction; // Guardar hacia dónde mira

        if (this.isClimbing) return;

        const speed = 3.5;
        Matter.Body.setVelocity(this.body, {
            x: direction * speed,
            y: this.body.velocity.y
        });
    }

    setClimbing(climbingState) {
        this.isClimbing = climbingState;
        this.body.isSensor = climbingState;
        if (!climbingState) this.climbingLadder = null;

        if (climbingState) {
            this.jumpBarrels = null;
            this.groundContacts.clear();
            this.isGrounded = false;
            Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
        }
    }

    climb(direction) {
        if (this.hammerTime > 0) return false;
        const ladder = this.climbingLadder || [...this.ladderContacts].map(body => body.ladder)
            .find(l => Math.abs(this.body.position.x - l.body.position.x) < (l.w + this.w) / 2);
        if (!ladder) return false;
        const standingY = platform => platform.surfaceY(ladder.body.position.x) - this.h / 2
            - Math.abs(Math.tan(platform.body.angle)) * this.w / 2 - 0.5;
        const top = ladder.topPlatform ? standingY(ladder.topPlatform) : ladder.top + this.h / 2;
        const bottom = standingY(ladder.bottomPlatform);
        if (!this.isClimbing && ((direction < 0 && this.body.position.y <= top + 1)
            || (direction > 0 && this.body.position.y >= bottom - 1))) return false;
        this.setClimbing(true);
        this.climbingLadder = ladder;
        const y = Math.max(top, Math.min(bottom, this.body.position.y + direction * 3));
        Matter.Body.setPosition(this.body, { x: ladder.body.position.x, y });
        Matter.Body.setVelocity(this.body, { x: 0, y: 0 });
        if ((direction < 0 && y === top && ladder.topPlatform) || (direction > 0 && y === bottom)) {
            this.setClimbing(false);
            this.groundContacts.add((direction < 0 ? ladder.topPlatform : ladder.bottomPlatform).body);
            this.isGrounded = true;
        }
        return true;
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
        return { x: this.body.position.x + (overhead ? 0 : this.facing * 27),
            y: this.body.position.y - (overhead ? 34 : 8) };
    }

    show() {
        push();
        translate(this.body.position.x, this.body.position.y);
        imageMode(CENTER);

        // Voltear horizontalmente si camina a la izquierda
        scale(this.facing, 1);

        // Si la imagen ya cargó, dibujamos el sprite. Si no, muestra el rectángulo base.
        if (marioImg) {
            image(marioImg, 0, 0, this.w + 6, this.h + 6);
        } else {
            rectMode(CENTER);
            fill(225, 40, 40);
            rect(0, 0, this.w, this.h);
        }

        pop();
        if (this.hammerTime > 0) {
            const head = this.hammerHead();
            drawHammer(head.x, head.y);
        }
    }
}
