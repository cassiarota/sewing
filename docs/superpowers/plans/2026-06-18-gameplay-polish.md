# Gameplay Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align stitches with the photographed needle, enlarge the garment, relabel the pedals, and add an exit-to-start action after each level.

**Architecture:** Keep the existing single-canvas game loop and modal state machine. Update the shared needle coordinate and cloth scale in `resizeCanvas()`, then extend the existing modal controls with one reset action so rendering, scoring, keyboard input, and touch input continue to share the same state.

**Tech Stack:** HTML5 Canvas, vanilla JavaScript, CSS, browser-based visual verification

---

### Task 1: Align the needle and enlarge the garment

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Update the shared needle anchor**

Change `resizeCanvas()` to use the photographed needle tip near `45.1%` across and `41.7%` down the machine image. Because `clothOrigin()` and `needleInCloth()` both consume `game.needle`, this updates drawing and scoring together.

- [ ] **Step 2: Increase responsive cloth scale**

Multiply the existing responsive scale by `1.2`, while retaining the clamp so desktop and mobile layouts remain bounded.

- [ ] **Step 3: Verify the canvas visually**

Run the game at `http://127.0.0.1:4173/index.html`, start a level, and confirm the first stitch appears beneath the photographed needle and the garment is approximately 20% larger.

### Task 2: Relabel pedal controls

**Files:**
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: Add semantic two-line labels**

Replace the single-letter content with a main label (`左踏板` or `右踏板`) and a small key label (`J键` or `K键`) without changing either button's `data-pedal` value.

- [ ] **Step 2: Stabilize control dimensions**

Update `.pedal-key` to use a compact vertical layout with sufficient width for Chinese text, and style the key hint as smaller secondary text.

- [ ] **Step 3: Verify desktop and narrow layouts**

Confirm both labels fit, expected/active states still render, and the buttons do not overlap the game modal.

### Task 3: Add exit-to-start level completion flow

**Files:**
- Modify: `index.html`
- Modify: `game.js`

- [ ] **Step 1: Add the exit button**

Add a hidden `#exitBtn` beside `#nextBtn` in the modal action row.

- [ ] **Step 2: Update modal state functions**

Make `showStartModal()` display only Start, `showNextModal()` display Exit and Next, and `hideModal()` hide all three controls.

- [ ] **Step 3: Implement reset-to-start**

Add a function that stops the game, clears keys, active pedal, movement, stitches, rewards, timers, score, and progress, regenerates the level-one preview, then displays the initial Start modal without reloading the page.

- [ ] **Step 4: Bind and verify both completion actions**

Bind `#exitBtn` to reset-to-start. In the browser, force or reach the completion modal and verify Exit returns to the initial modal while Next starts the next randomized level.

### Task 4: Extend the completion reward

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Throw two reward buns**

For scores above 60, add two buns with staggered starting positions and velocities so both bounce onto the table without completely overlapping.

- [ ] **Step 2: Keep the reward visible**

Change the reward copy to `奖励你两个馒头`, keep it visible for about three seconds, and delay the completion modal until the reward animation can be read.

### Task 5: Constrain random seams and vibration

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Share a garment hit area**

Represent the shirt silhouette as one polygon used by target generation, stitch placement, and vibration checks.

- [ ] **Step 2: Generate readable internal seams**

Start each seam near a side or bottom edge, direct it inward, keep later points inside a safe torso area, reject crossings, and reject points that approach older segments too closely.

- [ ] **Step 3: Stop off-garment stitching and vibration**

Continue allowing cloth movement outside the needle, but only add stitches and light movement shake while the needle point is inside the garment silhouette.

### Task 6: Final verification and commit

**Files:**
- Verify: `index.html`
- Verify: `style.css`
- Verify: `game.js`

- [ ] **Step 1: Run static checks**

Run `node --check game.js` and `git diff --check`; both must exit with code 0.

- [ ] **Step 2: Run browser checks**

Reload the local page, inspect console errors, validate the start modal, pedal labels, in-game scale/alignment, completion modal, Exit, and Next.

- [ ] **Step 3: Commit implementation**

Stage `index.html`, `style.css`, `game.js`, and this plan, then commit with message `polish needle alignment and level flow`.
