class Fireball {
    constructor(x, y, radius = 10) {
        this.r = radius;
        this.createdAt = millis();
        this.lifetime = 6500;

        this.body = Bodies.circle(x, y, this.r, {
            friction: 0.0,
            frictionStatic: 0.0,
            frictionAir: 0.001,
            restitution: 0.8,
            density: 0.01,
            collisionFilter: {
                group: 0,
                category: CATEGORY_FIRE,
                mask: CATEGORY_DEFAULT | CATEGORY_PLATFORM | CATEGORY_MARIO | CATEGORY_BARREL
            }
        });

        this.body.isFireball = true;
        World.add(world, this.body);

        this.speed = (1.8 + (currentLevel - 1) * 0.2) * difficulty;
        this.direction = random([1, -1]);
        
        Matter.Body.setVelocity(this.body, { x: this.direction * this.speed, y: -2 });
    }

    update() {
        // Mantener velocidad constante horizontal y rebotar si choca con bordes/paredes
        let currentVx = this.body.velocity.x;
        
        if (Math.abs(currentVx) < 0.5) {
            this.direction *= -1;
        } else {
            this.direction = Math.sign(currentVx);
        }

        // Cambio aleatorio de dirección ocasional
        if (random(1) < 0.005) {
            this.direction *= -1;
        }
        Matter.Body.setVelocity(this.body, { x: this.direction * this.speed, y: this.body.velocity.y });
    }

    removeFromWorld() {
        World.remove(world, this.body);
    }

    isExpired() {
        return millis() - this.createdAt >= this.lifetime;
    }

    show() {
        push();
        translate(this.body.position.x, this.body.position.y);
        imageMode(CENTER);

        if (typeof spriteSheet !== 'undefined' && spriteSheet && spriteSheet.width > 0) {
            noSmooth();

            let vx = this.body.velocity.x;
            let vy = this.body.velocity.y;
            let movingRight = vx >= 0;
            let isJumping = Math.abs(vy) > 0.6;

            let frameList;
            if (isJumping) {
                // Sprites de salto/rebote
                frameList = movingRight ? 
                    [ {x: 116, y: 96, w: 14, h: 14}, {x: 136, y: 96, w: 14, h: 14} ] : 
                    [ {x: 156, y: 96, w: 14, h: 14}, {x: 176, y: 96, w: 14, h: 14} ];
            } else {
                frameList = movingRight ? 
                    [ 
                        { x: 158, y: 96, w: 15, h: 16 }, 
                        { x: 180, y: 97, w: 13, h: 15 }  
                    ] : 
                    [ 
                        { x: 113, y: 97, w: 13, h: 15 }, 
                        { x: 133, y: 96, w: 15, h: 16 }  
                    ];
            }
            let frameIndex = Math.floor(millis() / 150) % frameList.length;
            let frame = frameList[frameIndex];

            let subImg = spriteSheet.get(frame.x, frame.y, frame.w, frame.h);
            image(subImg, 0, 0, this.r * 2.2, this.r * 2.2);

        } else {
            // Respaldo geométrico por seguridad
            noStroke();
            fill(255, 60, 0);
            circle(0, 0, this.r * 2);

            fill(255, 200, 0);
            circle(0, 0, this.r * 1.2);

            fill(255, 255, 200);
            circle(0, 0, this.r * 0.5);
        }
        pop();
    }
}
