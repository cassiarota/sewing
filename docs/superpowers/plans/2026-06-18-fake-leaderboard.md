# Fake Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a cheerful fake ten-person leaderboard when the player exits a completed level, then return to the start screen.

**Architecture:** Add a standalone DOM overlay beside the existing game modal. Keep ranking generation in small JavaScript functions that return structured rows, render those rows safely with DOM APIs, and reuse one reset function for the final return-to-start action.

**Tech Stack:** HTML5, CSS, vanilla JavaScript, GitHub Actions, Nginx static hosting

---

### Task 1: Add the leaderboard surface

**Files:**
- Modify: `index.html`
- Modify: `style.css`

- [ ] **Step 1: Add independent leaderboard markup**

Add `#leaderboardOverlay`, `#leaderboardRows`, and `#leaderboardReturnBtn` after the existing modal overlay. Keep it hidden initially and label the dialog with “本局排行榜”.

- [ ] **Step 2: Add responsive leaderboard styling**

Use a compact ten-row grid with rank, Chinese name, and score columns. Highlight the first row in gold, constrain the card height to the stage, and keep the return button below the rows.

### Task 2: Generate and render rankings

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Generate ten valid rows**

Create a Chinese-name pool and a `makeLeaderboard(playerScore)` function. Return “当前玩家” first, then nine unique random names whose integer scores are never above the player's score and are sorted descending.

- [ ] **Step 2: Render with DOM nodes**

Create each row with `document.createElement()` and `textContent`, assign rank classes, and replace the row container contents each time the overlay opens.

### Task 3: Connect exit and reset behavior

**Files:**
- Modify: `game.js`

- [ ] **Step 1: Extract reset-to-start behavior**

Move the existing exit reset statements into `returnToStart()` so the leaderboard return button and any future callers share the same reset path.

- [ ] **Step 2: Open leaderboard on Exit**

Change the existing Exit handler to hide the completion modal, generate rows from `game.score`, and show the independent leaderboard overlay without clearing score first.

- [ ] **Step 3: Return to main screen**

Bind `#leaderboardReturnBtn` to hide the leaderboard, reset the game, set score and progress to zero, and show only the Start modal.

### Task 4: Verify, publish, and deploy

**Files:**
- Verify: `index.html`
- Verify: `style.css`
- Verify: `game.js`
- Verify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add the prison-bar backdrop**

Restore the machine photo's original complete display ratio and draw the generated `assets/prison-bars-realistic.png` behind it with cover sizing so the photographic bars remain visible around the machine image.

- [ ] **Step 2: Run static checks**

Run `node --check game.js` and `git diff --check`; both must exit successfully.

- [ ] **Step 3: Run browser checks**

Open the leaderboard from a completion state and verify ten rows, first-place player, Chinese names, bounded scores, responsive layout, and Return-to-main reset. Check the browser console for errors.

- [ ] **Step 4: Commit and push main**

Commit the implementation with `add cheerful fake leaderboard`, then push `main` to `origin` as explicitly requested.

- [ ] **Step 5: Verify deployment**

Wait for the triggered GitHub Action to finish, confirm `/opt/sewing/site` contains the new leaderboard markup, and smoke-test `https://cassiangroup.uk/sewing/` in both curl and the in-app browser.
