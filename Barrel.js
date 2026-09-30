class Barrel {
    constructor(x, y, radius = 12) {
        this.r = radius;

        this.body = Bodies.circle(x, y, this.r, {
            friction: 0.0,
            frictionStatic: 0.0,
            frictionAir: 0.0005,
            restitution: 0.2,
            density: 0.01,
            collisionFilter: {
                category: CATEGORY_BARREL,
                // Al nacer, colisiona con todo (Plataformas, Mario, Fondo)
                mask: CATEGORY_DEFAULT | CATEGORY_PLATFORM | CATEGORY_MARIO | CATEGORY_LADDER
            }
        });

        this.body.isBarrel = true;
        this.isFallingLadder = false;
        this.ladderYTarget = 0;
        this.lastLadderTouched = null;

        World.add(world, this.body);

        // Impulso inicial a la derecha
        Matter.Body.setVelocity(this.body, { x: 2.5, y: 0 });
    }

updateLadderFall() {
    if (this.isFallingLadder) {
        // En cuanto el barril llega al nivel del piso inferior:
        if (this.body.position.y >= this.ladderYTarget) {
            this.isFallingLadder = false;

            // 1. Restaurar colisión con plataformas
            this.body.collisionFilter.mask = CATEGORY_DEFAULT | CATEGORY_PLATFORM | CATEGORY_MARIO | CATEGORY_LADDER;

            // 2. Determinar la dirección según la altura de la pantalla (Zigzag)
            // Si está en viga par o impar, le damos un empuje inicial para que empiece a rodar
            let direction = (Math.floor(this.body.position.y / 100) % 2 === 0) ? -2.0 : 2.0;

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
        this.updateLadderFall();

        push();
        translate(this.body.position.x, this.body.position.y);
        rotate(this.body.angle);

        rectMode(CENTER);
        ellipseMode(RADIUS);

        fill(160, 82, 45);
        stroke(255, 200, 100);
        strokeWeight(1.5);
        circle(0, 0, this.r);

        stroke(0);
        line(-this.r + 2, 0, this.r - 2, 0);

        pop();
    }
}
