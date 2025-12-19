# Readme

This project integrates the **Level Editor + Game** in one folder. Levels are created in the editor, saved as JSON on the server, and loaded by the game.

## New Features

* **Two apps served by the same Node/Express server:**

  * Level Editor (build/save/load/delete levels)
  * Game (plays levels saved by the editor)

* **Level storage (JSON):**

  * Levels are stored in `/levels` as `<id>.json`
  * REST API:

    * `GET /api/v1/levels` (list level IDs)
    * `GET /api/v1/levels/:id` (load a level)
    * `POST /api/v1/levels` (create a level)
    * `PUT /api/v1/levels/:id` (update a level)
    * `DELETE /api/v1/levels/:id` (delete a level)

* **New placeable entities (Editor):**

  * Block (square)
  * Enemy (inverted triangle)
  * Catapult (diamond)
  * Bird (circle)
  * Support (vertical rectangle)

* **Editor → Game mapping:**

  * Block → dynamic physics box
  * Support → dynamic physics box
  * Enemy → pig (circle collider)
  * Catapult → static base + used to compute bird spawn
  * Bird → spawn marker (used only if no catapult exists)

* **Spawn rules:**

  * If a **Catapult** exists, the **Bird spawns above it**
  * Else if a **Bird** marker exists, the bird spawns there
  * Else fallback to a default spawn

* **Progression:**

  * Level completes when all enemies are destroyed
  * Automatically loads the next level from the server list
  * Shows a final win message when the last level is completed
  * Game Over triggers when you run out of birds (then reloads the current level)

* **Visual shapes and colors:**

  * **Editor (CSS):**

    * Shared base class: `.block`
    * Type-specific classes: `.type-block`, `.type-enemy`, `.type-catapult`, `.type-bird`, `.type-support`
  * **Game (Canvas):**

    * Colors are set in `game.js` inside `drawBoxes()`, `drawPigs()`, `drawBird()`, etc.
    * Background/UI styling is in `game.css`

## Run

1. Install dependencies:

   * `npm install express cors`
2. Start the server:

   * `node server.js`
3. Open:

   * Editor: `http://localhost:3000/editor/`
   * Game: `http://localhost:3000/game/`
