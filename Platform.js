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
                category: CATEGORY_PLATFORM
            }
        });

        this.body.isPlatform = true;
        World.add(world, this.body);
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
