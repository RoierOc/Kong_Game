class Barrel {
    constructor(x, y, radius = 12) {
        this.r = radius;
        this.jumpScored = false;

        this.body = Bodies.circle(x, y, this.r, {
            friction: 0.0,
            frictionStatic: 0.0,
            frictionAir: 0.0005,
            restitution: 0.2,
            density: 0.01,
            collisionFilter: {
                group: 0,
                category: CATEGORY_BARREL,
                mask: CATEGORY_DEFAULT | CATEGORY_PLATFORM | CATEGORY_MARIO | CATEGORY_LADDER | CATEGORY_FIRE
            }
        });

        this.body.isBarrel = true;
        this.isFallingLadder = false;
        this.ladderYTarget = 0;
        this.lastLadderTouched = null;

        World.add(world, this.body);

        // Impulso inicial a la derecha
        Matter.Body.setVelocity(this.body, { x: (2.5 + (currentLevel - 1) * 0.2) * difficulty, y: 0 });
    }

    updateLadderFall() {
        if (this.isFallingLadder) {
            if (this.body.position.y >= this.ladderYTarget) {
                this.isFallingLadder = false;
                this.body.collisionFilter.mask = CATEGORY_DEFAULT | CATEGORY_PLATFORM | CATEGORY_MARIO | CATEGORY_LADDER | CATEGORY_FIRE;

                const speed = (2.0 + (currentLevel - 1) * 0.2) * difficulty;
                let direction = (Math.floor(this.body.position.y / 100) % 2 === 0) ? -speed : speed;

                Matter.Body.setVelocity(this.body, { 
                    x: direction, 
                    y: this.body.velocity.y 
                });
            }
        }
    }

    isOffscreen() {
        return (this.body.position.y > height + 50);
    }

    removeFromWorld() {
        World.remove(world, this.body);
    }

    show() {
        push();
        translate(this.body.position.x, this.body.position.y);
        imageMode(CENTER);

        if (typeof spriteSheet !== 'undefined' && spriteSheet && spriteSheet.width > 0) {
            noSmooth();
            
            let vx = this.body.velocity.x;

            let frameIndex = Math.floor(Math.abs(this.body.position.x) / 15) % 4;
           
            const frameCoords = [
                { x: 66, y: 133 },
                { x: 81, y: 133 },
                { x: 66, y: 145 },
                { x: 81, y: 145 }
            ];

            let currentFrame = frameCoords[frameIndex];
            let subImg = spriteSheet.get(currentFrame.x, currentFrame.y, 12, 10);

            // Si el barril va hacia la izquierda, invertimos horizontalmente el sprite
            if (vx < -0.1) {
                scale(-1, 1);
            }

            image(subImg, 0, 0, this.r * 2, this.r * 1.6);
        } else {
            // Fallback geométrico de respaldo
            rotate(this.body.angle);
            rectMode(CENTER);
            ellipseMode(RADIUS);

            fill(160, 82, 45);
            stroke(255, 200, 100);
            strokeWeight(1.5);
            circle(0, 0, this.r);

            stroke(0);
            line(-this.r + 2, 0, this.r - 2, 0);
        }
        pop();
    }
}
