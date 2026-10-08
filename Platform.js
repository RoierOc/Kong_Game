class Platform {
constructor(x, y, w, h, angle = 0) {
        this.w = w;
        this.h = h;

        this.body = Bodies.rectangle(x, y, w, h, {
            isStatic: true,
            angle: angle,
            friction: 0.01,
            frictionStatic: 0.0,
            collisionFilter: {
                group: 0,
                category: CATEGORY_PLATFORM,
                mask: 0xFFFF
            }
        });

        this.body.isPlatform = true;
        World.add(world, this.body);
    }

    surfaceY(x) {
        return this.body.position.y + Math.tan(this.body.angle) * (x - this.body.position.x)
            - this.h / (2 * Math.cos(this.body.angle));
    }

    show() {
        push();
        rectMode(CENTER);
        fill(216, 40, 80);
        stroke(255);
        strokeWeight(1);
        translate(this.body.position.x, this.body.position.y);
        rotate(this.body.angle);
        rect(0, 0, this.w, this.h);
        pop();
    }
}
