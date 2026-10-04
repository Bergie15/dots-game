# Bubble Breaker

A browser remake of the classic Android *Bubble Breaker* game. Plain HTML/CSS/JS — no build step — so it runs directly on GitHub Pages.

## How to play

- Tap a group of **2 or more** touching bubbles of the same color (up/down/left/right).
- One tap pops a group: the bubbles burst one after another outward from where you tapped, each showing its points. Big groups get a "Good!", "Great!" or "Perfect!". If you prefer to preview a group's value first, switch to **Tap twice** in **Settings** (gear icon).
- Each bubble in a group is worth 10 more than the last: 5, 15, 25, 35… So 2 bubbles = 20, 3 = 45, 4 = 80, 10 = 500 (`5 × n²`). Bigger groups are worth much more.
- Bubbles above a popped group fall down. When a column is emptied, the remaining columns slide over to close the gap.
- **Classic** mode: the game ends when no groups of 2+ remain.
- End-of-board bonus (both modes): 2,000 for clearing the board, minus 20 × (bubbles left)² — e.g. 5 left = +1,500, 9 left = +380, 10 or more = no bonus.
- **Levels** mode (10×10 board by default): your running total must reach the level's target — 1,000, 3,000, 5,000, 7,000… (+2,000 per level). When you run out of moves, reaching the goal moves you on to the next level with a fresh board; otherwise it's game over and you start again from level 1. Progress is saved.
- **Coins**: you start with 100. Completing a stage earns 1 coin, 5 coins if fewer than 5 bubbles are left, or 10 coins for clearing the board.
- **Powers** (tap one, then tap a bubble; tap the power again to cancel). Undo refunds a power.
  - 🔨 **Hammer** (20 coins): crush the 3×3 area around a bubble (no points).
  - ⭐ **Star** (50 coins): turn the 3×3 area around a bubble into that bubble's color.
  - 🌈 **Rainbow** (100 coins): change one bubble to a color you pick.
- **Settings** (gear icon) also lets you pick the bubble size: Small (14×16), Medium (12×14), Large (10×10) or Extra large (8×9). Each mode remembers its own size (Classic defaults to Medium, Levels to Large); level goals scale with the number of bubbles on the board.
- **Undo** reverts your last move; your best score is saved in the browser.

## Hosting on GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick the branch and the `/ (root)` folder, and save.
4. The game will be live at `https://<username>.github.io/<repo>/` within a minute or two.

To play locally, just open `index.html` in a browser.
