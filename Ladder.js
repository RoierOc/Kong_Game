class Ladder {
    constructor(x, y, w, h) {
        this.w = w;
        this.h = h;

        // Cuerpo físico estático en modo "sensor" (no bloquea a Mario, solo detecta)
        this.body = Bodies.rectangle(x, y, w, h, {
            isStatic: true,
            isSensor: true,
            collisionFilter: { group: 0, category: CATEGORY_LADDER, mask: CATEGORY_MARIO | CATEGORY_BARREL }
        });

        this.body.isLadder = true;
        World.add(world, this.body);
    }

    show() {
        push();
        rectMode(CENTER);
        stroke(100, 200, 255); // Color azul claro clásico
        strokeWeight(3);
        
        // Dibujar los parantes verticales
        const halfW = this.w / 2;
        const halfH = this.h / 2;
        line(this.body.position.x - halfW, this.body.position.y - halfH, this.body.position.x - halfW, this.body.position.y + halfH);
        line(this.body.position.x + halfW, this.body.position.y - halfH, this.body.position.x + halfW, this.body.position.y + halfH);

        // Dibujar los peldaños horizontales
        const stepSpacing = 12;
        for (let y = -halfH + 6; y < halfH; y += stepSpacing) {
            line(
                this.body.position.x - halfW,
                this.body.position.y + y,
                this.body.position.x + halfW,
                this.body.position.y + y
            );
        }
        pop();
    }
}
