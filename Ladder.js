class Ladder {
    constructor(x, w, topPlatform, bottomPlatform, h = 65) {
        this.w = w;
        this.topPlatform = topPlatform;
        this.bottomPlatform = bottomPlatform;
        this.bottom = bottomPlatform.surfaceY(x);
        this.top = topPlatform ? topPlatform.surfaceY(x) : this.bottom - h;
        this.h = this.bottom - this.top;

        // Cuerpo físico estático en modo "sensor" (no bloquea a Mario, solo detecta)
        this.body = Bodies.rectangle(x, (this.top + this.bottom) / 2, w, this.h + 4, {
            isStatic: true,
            isSensor: true,
            collisionFilter: { group: 0, category: CATEGORY_LADDER, mask: CATEGORY_MARIO | CATEGORY_BARREL }
        });

        this.body.isLadder = true;
        this.body.ladder = this;
        World.add(world, this.body);
    }

    show() {
        push();
        rectMode(CENTER);
        stroke(100, 200, 255); // Color azul claro clásico
        strokeWeight(3);
        
        // Dibujar los parantes verticales
        const halfW = this.w / 2;
        const x = this.body.position.x;
        const tops = [];
        const bottoms = [];
        for (const railX of [x - halfW, x + halfW]) {
            const top = this.topPlatform ? this.topPlatform.surfaceY(railX)
                + this.topPlatform.h / Math.cos(this.topPlatform.body.angle) + 2 : this.top;
            const bottom = this.bottomPlatform.surfaceY(railX) - 2;
            tops.push(top);
            bottoms.push(bottom);
            line(railX, top, railX, bottom);
        }

        // Dibujar los peldaños horizontales
        const stepSpacing = 12;
        for (let y = Math.max(...tops) + 6; y < Math.min(...bottoms); y += stepSpacing) {
            line(x - halfW, y, x + halfW, y);
        }
        pop();
    }
}
