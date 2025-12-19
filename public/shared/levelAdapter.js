(function () {
    // Convert editor level (px, up-left origin)
    // to game level (Planck, down-left origin)

    function blockCenterPx(b) {
        return {
            cx: b.x + b.width / 2,
            cy: b.y + b.height / 2,
        };
    }

    function pxToWorld({ cx, cy }, editorHeightPx, scale) {
        const x = cx / scale;
        const y = (editorHeightPx - cy) / scale; // flip Y
        return { x, y };
    }

    function editorBlocksToGameLevel(blocks, options) {

        const scale = options.scale;
        const editorHeightPx = options.editorHeightPx;

        const pigs = [];
        const boxes = [];

        let birdStart = options.defaultBirdStart; // {x,y} meters

        let catapultWorldCenter = null;
        let catapultHeightM = 0;

        for (const b of blocks) {
            const center = blockCenterPx(b);
            const wpos = pxToWorld(center, editorHeightPx, scale);

            if (b.type === "enemy") {
                pigs.push({ x: wpos.x, y: wpos.y });
                continue;
            }

            if (b.type === "bird") {
                birdStart = { x: wpos.x, y: wpos.y };
                continue;
            }

            if (b.type === "block" || b.type === "support" || b.type === "catapult") {
                if (b.type === "catapult" && !catapultWorldCenter) {
                    catapultWorldCenter = { x: wpos.x, y: wpos.y };
                    catapultHeightM = b.height / scale;
                }

                boxes.push({
                    x: wpos.x,
                    y: wpos.y,
                    width: b.width / scale,
                    height: b.height / scale,
                    dynamic: (b.type === "block" || b.type === "support"),
                });
                continue;
            }
        }

        if (catapultWorldCenter) {
            const gapM = 0.15;
            const birdRadiusM = options.birdRadius ?? 0.5;

            const catapultTopY = catapultWorldCenter.y + (catapultHeightM / 2);

            birdStart = {
                x: catapultWorldCenter.x,
                y: catapultTopY + birdRadiusM + gapM,
            };
        }

        return { pigs, boxes, birdStart };
    }

    // global export
    window.LevelAdapter = { editorBlocksToGameLevel };
})();
