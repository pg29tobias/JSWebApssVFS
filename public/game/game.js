(() => {
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    const headerEl = document.querySelector("header");
    const footerEl = document.querySelector("footer");

    const loadLevelBtn = document.getElementById("loadLevelBtn");
    const nextLevelBtn = document.getElementById("nextLevelBtn");
    const levelIdInput = document.getElementById("levelIdInput");

    const SCALE = 30;

    const EDITOR_HEIGHT_PX = 600;

    const resizeCanvas = () => {
        const headerHeight = headerEl?.offsetHeight ?? 0;
        const footerHeight = footerEl?.offsetHeight ?? 0;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - headerHeight - footerHeight;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const pl = planck;
    const Vec2 = pl.Vec2;

    const createWorld = () => {
        const world = new pl.World({ gravity: Vec2(0, -10) });

        const ground = world.createBody();
        ground.createFixture(pl.Edge(Vec2(-50, 0), Vec2(50, 0)), { friction: 0.8 });

        return { world, ground };
    };

    const { world, ground } = createWorld();

    const TIME_STEP = 1 / 60;
    const VELOCITY_ITERS = 8;
    const POSITION_ITERS = 3;

    const BIRD_RADIUS = 0.5;
    const DEFAULT_BIRD_START = { x: 5, y: 5 };
    const PIG_RADIUS = 0.3;

    const BIRD_STOP_SPEED = 0.15;
    const BIRD_STOP_ANGULAR = 0.25;
    const BIRD_IDLE_SECONDS = 1.0;
    const BIRD_MAX_FLIGHT_SECONDS = 10.0;

    const BIRDS_PER_LEVEL = 3;

    // ----------------
    // State (sin bugs)
    // ----------------
    let state = {
        levelIds: [],          
        currentIndex: 0,       
        currentLevelId: null,  
        score: 0,

        birdsRemaining: BIRDS_PER_LEVEL,
        isLevelComplete: false,

        pigs: [],
        boxes: [],
        bird: null,
        birdLaunched: false,
        levelBirdStart: null,

        isMouseDown: false,
        mousePos: Vec2(0, 0),
        launchVector: Vec2(0, 0),
    };

    const setState = (patch) => {
        state = { ...state, ...patch };
    };

    let birdIdleTime = 0;
    let birdFlightTime = 0;

    let levelCompleteTimer = null;
    let gameOverTimer = null;

    const resetBirdTimers = () => {
        birdIdleTime = 0;
        birdFlightTime = 0;
    };

    // --------------
    // Creation Utils
    // --------------
    const createBox = (x, y, width, height, dynamic = true) => {
        const body = world.createBody({
            position: Vec2(x, y),
            type: dynamic ? "dynamic" : "static",
        });

        body.createFixture(pl.Box(width / 2, height / 2), {
            density: 1.0,
            friction: 0.5,
            restitution: 0.1,
        });

        return body;
    };

    const createPig = (x, y) => {
        const body = world.createDynamicBody({ position: Vec2(x, y) });

        body.createFixture(pl.Circle(PIG_RADIUS), {
            density: 0.5,
            friction: 0.5,
            restitution: 0.1,
            userData: "pig",
        });

        body.isPig = true;
        return body;
    };

    const createBird = (birdStart) => {
        const bird = world.createDynamicBody(Vec2(birdStart.x, birdStart.y));
        bird.createFixture(pl.Circle(BIRD_RADIUS), {
            density: 0.5,
            friction: 0.6,
            restitution: 0.4,
        });

        bird.setLinearDamping(0.35);
        bird.setAngularDamping(0.35);
        bird.setSleepingAllowed(true);

        return bird;
    };

    const destroyBirdIfExists = () => {
        if (state.bird) world.destroyBody(state.bird);
    };

    const clearWorldExceptGround = () => {
        for (let body = world.getBodyList(); body;) {
            const next = body.getNext();
            if (body !== ground) world.destroyBody(body);
            body = next;
        }
    };

    // -------------------------
    // Server IO (niveles reales)
    // -------------------------
    async function fetchLevelIds() {
        const res = await fetch("/api/v1/levels");
        if (!res.ok) throw new Error("Failed to fetch level list");
        const data = await res.json();
        return Array.isArray(data.ids) ? data.ids : [];
    }

    async function fetchLevelById(id) {
        const res = await fetch("/api/v1/levels/" + encodeURIComponent(id));
        if (!res.ok) throw new Error("Level not found: " + id);
        return await res.json(); // {id, blocks}
    }

    // ----------------
    // Level load/init
    // ----------------
    function initLevelFromBlocks(levelId, blocks) {
        if (levelCompleteTimer) {
            clearTimeout(levelCompleteTimer);
            levelCompleteTimer = null;
        }

        if (gameOverTimer) {
            clearTimeout(gameOverTimer);
            gameOverTimer = null;
        }

        clearWorldExceptGround();

        const converted = window.LevelAdapter.editorBlocksToGameLevel(blocks, {
            scale: SCALE,
            editorHeightPx: EDITOR_HEIGHT_PX,
            defaultBirdStart: DEFAULT_BIRD_START,
            birdRadius: BIRD_RADIUS,
        });

        const boxes = converted.boxes.map((b) =>
            createBox(b.x, b.y, b.width, b.height, b.dynamic)
        );
        const pigs = converted.pigs.map((p) => createPig(p.x, p.y));

        const bird = createBird(converted.birdStart);
        resetBirdTimers();

        setState({
            currentLevelId: levelId,
            pigs,
            boxes,
            bird,
            isLevelComplete: false,
            birdLaunched: false,
            birdsRemaining: BIRDS_PER_LEVEL,
            isMouseDown: false,
            mousePos: Vec2(0, 0),
            launchVector: Vec2(0, 0),
            levelBirdStart: converted.birdStart,
        });
    }

    async function loadLevelById(levelId) {
        const data = await fetchLevelById(levelId);
        initLevelFromBlocks(data.id, data.blocks || []);
    }

    async function boot() {
        try {
            const ids = await fetchLevelIds();
            setState({ levelIds: ids, currentIndex: 0 });

            if (ids.length > 0) {
                levelIdInput.value = ids[0];
                await loadLevelById(ids[0]);
            } else {
                initLevelFromBlocks("no-levels", []);
            }
        } catch (e) {
            console.error(e);
            initLevelFromBlocks("error", []);
        }
    }

    async function nextLevel() {
        if (state.levelIds.length === 0) return;

        const next = state.currentIndex + 1;

        if (next >= state.levelIds.length) {
            alert("Congratulations, you won!");

            setState({ currentIndex: 0, score: 0 });

            const firstId = state.levelIds[0];
            if (firstId) {
                levelIdInput.value = firstId;
                await loadLevelById(firstId);
            }
            return;
        }


        const nextId = state.levelIds[next];
        setState({ currentIndex: next });
        levelIdInput.value = nextId;
        await loadLevelById(nextId);
    }

    // ----------------
    // Input Utils
    // ----------------
    const getMouseWorldPos = (event) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (event.clientX - rect.left) / SCALE;
        const mouseY = (canvas.height - (event.clientY - rect.top)) / SCALE;
        return Vec2(mouseX, mouseY);
    };

    const isPointOnBird = (point) => {
        const birdPos = state.bird?.getPosition();
        if (!birdPos) return false;
        return Vec2.distance(birdPos, point) < BIRD_RADIUS;
    };

    // --------------
    // Listeners
    // --------------
    canvas.addEventListener("mousedown", (event) => {
        if (state.birdsRemaining <= 0 || state.birdLaunched || !state.bird) return;
        const worldPos = getMouseWorldPos(event);
        if (isPointOnBird(worldPos)) {
            setState({ isMouseDown: true, mousePos: worldPos });
        }
    });

    canvas.addEventListener("mousemove", (event) => {
        if (!state.isMouseDown || !state.bird) return;
        const worldPos = getMouseWorldPos(event);
        const launchVector = Vec2.sub(state.bird.getPosition(), worldPos);

        setState({
            mousePos: worldPos,
            launchVector,
        });
    });

    canvas.addEventListener("mouseup", () => {
        if (!state.isMouseDown || !state.bird) return;

        const bird = state.bird;
        bird.setLinearVelocity(Vec2(0, 0));
        bird.setAngularVelocity(0);

        const impulse = state.launchVector.mul(5);
        bird.applyLinearImpulse(impulse, bird.getWorldCenter(), true);

        resetBirdTimers();

        setState({
            isMouseDown: false,
            birdLaunched: true,
            birdsRemaining: state.birdsRemaining - 1,
        });
    });

    loadLevelBtn.addEventListener("click", async () => {
        const id = levelIdInput.value.trim();
        if (!id) return;

        try {
            const ids = await fetchLevelIds();
            setState({ levelIds: ids });

            await loadLevelById(id);

            const idx = ids.indexOf(id);
            if (idx >= 0) setState({ currentIndex: idx });
        } catch (e) {
            alert(String(e.message || e));
        }
    });

    nextLevelBtn.addEventListener("click", () => {
        nextLevel().catch(console.error);
    });

    // ----------------
    // Collision Logic
    // ----------------
    const isGround = (body) => body === ground;

    world.on("post-solve", (contact, impulse) => {
        if (!impulse) return;

        const fixtureA = contact.getFixtureA();
        const fixtureB = contact.getFixtureB();
        const bodyA = fixtureA.getBody();
        const bodyB = fixtureB.getBody();

        if (!(bodyA.isPig || bodyB.isPig)) return;

        const pigBody = bodyA.isPig ? bodyA : bodyB;
        const otherBody = bodyB.isPig ? bodyB : bodyA;

        if (isGround(otherBody)) return;

        const normalImpulse = impulse.normalImpulses?.[0] ?? 0;
        if (normalImpulse > 1.0) pigBody.isDestroyed = true;
    });

    // ----------------
    // Update Step
    // ----------------
    const updateBirdTimers = () => {
        const bird = state.bird;
        if (!state.birdLaunched || !bird) return;

        birdFlightTime += TIME_STEP;
        const speed = bird.getLinearVelocity().length();
        const ang = Math.abs(bird.getAngularVelocity());

        if (speed < BIRD_STOP_SPEED && ang < BIRD_STOP_ANGULAR && !state.isMouseDown) {
            birdIdleTime += TIME_STEP;
        } else {
            birdIdleTime = 0;
        }
    };

    const shouldRespawnBird = () => {
        const bird = state.bird;
        if (!state.birdLaunched || !bird) return false;

        const pos = bird.getPosition();

        const outRight = pos.x > 50;
        const outLow = pos.y < -10;
        const idleLongEnough = birdIdleTime >= BIRD_IDLE_SECONDS;
        const timedOut = birdFlightTime >= BIRD_MAX_FLIGHT_SECONDS;

        return outRight || outLow || idleLongEnough || timedOut;
    };

    const handlePigCleanup = () => {
        const remaining = state.pigs.filter((pig) => {
            if (!pig.isDestroyed) return true;
            world.destroyBody(pig);
            return false;
        });

        const removedCount = state.pigs.length - remaining.length;
        if (removedCount > 0) {
            setState({
                pigs: remaining,
                score: state.score + removedCount * 100,
            });
        }
    };

    const checkLevelComplete = () => {
        if (state.isLevelComplete) return;
        if (state.pigs.length > 0) return;

        setState({ isLevelComplete: true });
        if (!levelCompleteTimer) {
            levelCompleteTimer = setTimeout(() => {
                levelCompleteTimer = null;
                alert("Level Complete");
                nextLevel().catch(console.error);
            }, 500);
        }
    };

    const respawnBird = () => {
        destroyBirdIfExists();

        const spawn = state.levelBirdStart ?? DEFAULT_BIRD_START;
        const bird = createBird(spawn);
        resetBirdTimers();

        setState({
            bird,
            birdLaunched: false,
            isMouseDown: false,
            launchVector: Vec2(0, 0),
        });
    };

    const handleBirdLifecycle = () => {
        if (!shouldRespawnBird()) return;

        if (state.birdsRemaining > 0) {
            respawnBird();
            return;
        }

        if (!state.isLevelComplete && !gameOverTimer) {
            gameOverTimer = setTimeout(async () => {
                alert("Game Over");

                const id = state.currentLevelId;
                try {
                    if (id && id !== "no-levels" && id !== "error") {
                        await loadLevelById(id);
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    gameOverTimer = null;
                }
            }, 500);
        }
    };

    const update = () => {
        world.step(TIME_STEP, VELOCITY_ITERS, POSITION_ITERS);

        updateBirdTimers();
        handlePigCleanup();
        checkLevelComplete();
        handleBirdLifecycle();
    };

    // --------------
    // Rendering :)
    // --------------
    const toCanvasY = (yMeters) => canvas.height - yMeters * SCALE;

    const drawGround = () => {
        ctx.beginPath();
        ctx.moveTo(0, toCanvasY(0));
        ctx.lineTo(canvas.width, toCanvasY(0));
        ctx.strokeStyle = "#004d40";
        ctx.lineWidth = 2;
        ctx.stroke();
    };

    const drawBoxes = () => {
        state.boxes.forEach((box) => {
            const position = box.getPosition();
            const angle = box.getAngle();
            const shape = box.getFixtureList().getShape();
            const vertices = shape.m_vertices;

            ctx.save();
            ctx.translate(position.x * SCALE, toCanvasY(position.y));
            ctx.rotate(-angle);

            ctx.beginPath();
            ctx.moveTo(vertices[0].x * SCALE, -vertices[0].y * SCALE);
            for (let i = 1; i < vertices.length; i++) {
                ctx.lineTo(vertices[i].x * SCALE, -vertices[i].y * SCALE);
            }
            ctx.closePath();

            ctx.fillStyle = "#070707";
            ctx.fill();
            ctx.restore();
        });
    };

    const drawPigs = () => {
        state.pigs.forEach((pig) => {
            const position = pig.getPosition();

            ctx.beginPath();
            ctx.arc(
                position.x * SCALE,
                toCanvasY(position.y),
                PIG_RADIUS * SCALE,
                0,
                2 * Math.PI * 2
            );
            ctx.fillStyle = "#e63946";
            ctx.fill();
        });
    };

    const drawBird = () => {
        if (!state.bird) return;
        const position = state.bird.getPosition();

        ctx.beginPath();
        ctx.arc(
            position.x * SCALE,
            toCanvasY(position.y),
            BIRD_RADIUS * SCALE,
            0,
            2 * Math.PI * 2
        );
        ctx.fillStyle = "#2024dc";
        ctx.fill();
    };

    const drawLaunchLine = () => {
        if (!state.isMouseDown || !state.bird) return;
        const birdPos = state.bird.getPosition();

        ctx.beginPath();
        ctx.moveTo(birdPos.x * SCALE, toCanvasY(birdPos.y));
        ctx.lineTo(state.mousePos.x * SCALE, toCanvasY(state.mousePos.y));

        ctx.strokeStyle = "#9e9e9e";
        ctx.lineWidth = 2;
        ctx.stroke();
    };

    const drawHUD = () => {
        ctx.fillStyle = "#000";
        ctx.font = "16px Cambria";
        ctx.fillText(`Score: ${state.score}`, 10, 20);
        ctx.fillText(`Level ID: ${state.currentLevelId ?? "-"}`, 10, 40);
        ctx.fillText(`Birds Remaining: ${state.birdsRemaining}`, 10, 60);
    };

    const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawGround();
        drawBoxes();
        drawPigs();
        drawBird();
        drawLaunchLine();
        drawHUD();
    };

    const loop = () => {
        update();
        draw();
        requestAnimationFrame(loop);
    };

    boot().then(loop).catch(console.error);
})();
