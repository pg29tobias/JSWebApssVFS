const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // serves /public as root

const LEVELS_DIR = path.join(__dirname, "levels");

if (!fs.existsSync(LEVELS_DIR)) {
    fs.mkdirSync(LEVELS_DIR);
    console.log("Created level directory at", LEVELS_DIR);
}

function sanitizeId(rawId) {
    const id = String(rawId || "").trim();
    if (!id) return "";
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return "";
    return id;
}

function generateId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return String(Date.now());
}

function levelFilePath(id) {
    return path.join(LEVELS_DIR, `${id}.json`);
}

function writeLevel(id, blocks, callback) {
    const json = JSON.stringify(blocks, null, 2);
    fs.writeFile(levelFilePath(id), json, "utf8", callback);
}

function readLevel(id, callback) {
    fs.readFile(levelFilePath(id), "utf8", (err, data) => {
        if (err) return callback(err);

        try {
            const blocks = JSON.parse(data);
            if (!Array.isArray(blocks)) {
                return callback(new Error("Level does not contain an array"));
            }
            callback(null, blocks);
        } catch (parseErr) {
            callback(parseErr);
        }
    });
}

function listLevelIds(callback) {
    fs.readdir(LEVELS_DIR, (err, files) => {
        if (err) return callback(err);

        const ids = files
            .filter((f) => f.endsWith(".json"))
            .map((f) => f.replace(/\.json$/, ""))
            .sort();

        callback(null, ids);
    });
}

// API: list levels
app.get('/api/v1/levels', (req, res) => {
    fs.readdir(LEVELS_DIR, (err, files) => {
        if (err) {
            console.error("Error listing levels:", err);
            return res.status(500).json({ error: "Failed to list levels" });
        }

        const ids = files
            .filter(f => f.endsWith(".json"))
            .map(f => f.replace(/\.json$/, ""))
            .sort();

        res.json({ ids });
    });
});

// API: read level by id
app.get("/api/v1/levels/:id", (req, res) => {
    const id = sanitizeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid level id" });

    readLevel(id, (err, blocks) => {
        if (err) {
            console.error("Error reading level data:", err);
            return res.status(404).json({ error: "Level not found" });
        }
        res.json({ id, blocks });
    });
});

// API: create level
app.post("/api/v1/levels", (req, res) => {
    let { id, blocks } = req.body;

    if (!Array.isArray(blocks) || blocks.length === 0) {
        return res
            .status(411)
            .json({ error: "Request body must have a non-empty 'blocks' array" });
    }

    const clean = sanitizeId(id);
    const finalId = clean || generateId();

    const filePath = levelFilePath(finalId);
    if (fs.existsSync(filePath)) {
        return res.status(409).json({ error: `Level with ID ${finalId} already exists` });
    }

    writeLevel(finalId, blocks, (err) => {
        if (err) {
            console.error("Error saving data", err);
            return res.status(500).json({ error: "Failed to save level" });
        }

        res
            .status(201)
            .location(`/api/v1/levels/${finalId}`)
            .json({ message: "level created", id: finalId, blocks });
    });
});

// API: update/create level with fixed id
app.put("/api/v1/levels/:id", (req, res) => {
    const id = sanitizeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid level id" });

    const { blocks } = req.body;

    if (!Array.isArray(blocks) || blocks.length === 0) {
        return res
            .status(411)
            .json({ error: "Request body must have a non-empty 'blocks' array" });
    }

    const filePath = levelFilePath(id);
    const exists = fs.existsSync(filePath);

    writeLevel(id, blocks, (err) => {
        if (err) {
            console.error("Error saving data", err);
            return res.status(500).json({ error: "Failed to save level" });
        }

        res.status(exists ? 200 : 201).json({
            message: exists ? "Level updated" : "Level created",
            id,
            blocks,
        });
    });
});

// API: delete
app.delete("/api/v1/levels/:id", (req, res) => {
    const id = sanitizeId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid level id" });

    const filePath = levelFilePath(id);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Level not found" });
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error("Error deleting data", err);
            return res.status(500).json({ error: "Failed to delete level" });
        }

        res.status(204).send();
    });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Editor: http://localhost:${PORT}/editor/`);
    console.log(`Game:   http://localhost:${PORT}/game/`);
});
