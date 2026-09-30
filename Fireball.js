class Fireball {
    constructor(x, y, radius = 10) {
        this.r = radius;

        this.body = Bodies.circle(x, y, this.r, {
            friction: 0.0,
            frictionStatic: 0.0,
            frictionAir: 0.001,
            restitution: 0.8,
            density: 0.01,
            collisionFilter: {
                category: CATEGORY_FIRE,
                mask: CATEGORY_DEFAULT | CATEGORY_PLATFORM | CATEGORY_MARIO | CATEGORY_BARREL
            }
        });

        this.body.isFireball = true;
        World.add(world, this.body);

        this.speed = 1.8;
        this.direction = random([1, -1]);
        
        Matter.Body.setVelocity(this.body, { x: this.direction * this.speed, y: -2 });
    }

    update() {
        // Mantener velocidad constante horizontal y rebotar si choca con bordes/paredes
        let currentVx = this.body.velocity.x;
        
        if (Math.abs(currentVx) < 0.5) {
            this.direction *= -1;
            Matter.Body.setVelocity(this.body, { 
                x: this.direction * this.speed, 
                y: this.body.velocity.y 
            });
        }

        // Cambio aleatorio de dirección ocasional
        if (random(1) < 0.005) {
            this.direction *= -1;
        }

        // --- CHEQUEO DIRECTO DE DESTRUCCIÓN DE BARRILES POR PROXIMIDAD ---
        // (Garantiza la eliminación sin importar si el evento de Matter.js se retrasa)
        for (let i = barrels.length - 1; i >= 0; i--) {
            let b = barrels[i];
            let d = dist(this.body.position.x, this.body.position.y, b.body.position.x, b.body.position.y);
            
            // Si la distancia entre el centro del fuego y del barril es menor a la suma de sus radios:
            if (d < this.r + b.r) {
                b.removeFromWorld();
                barrels.splice(i, 1);
                console.log("¡Fuego destruyó un barril!");
            }
        }
    }

    removeFromWorld() {
        World.remove(world, this.body);
    }

    show() {
        this.update();

        push();
        translate(this.body.position.x, this.body.position.y);
        
        noStroke();
        fill(255, 60, 0);
        circle(0, 0, this.r * 2);

        fill(255, 200, 0);
        circle(0, 0, this.r * 1.2);

        fill(255, 255, 200);
        circle(0, 0, this.r * 0.5);
        pop();
    }
}
