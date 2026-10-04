# Bubble Breaker

A browser remake of the classic Android *Bubble Breaker* game. Plain HTML/CSS/JS — no build step — so it runs directly on GitHub Pages.

## How to play

- Tap a group of **2 or more** touching bubbles of the same color (up/down/left/right).
- In **2-tap** mode (default) the first tap highlights the group and shows its value; tap it again to pop. Switch to tap-once popping in **Settings** (gear icon).
- Each bubble in a group is worth 10 more than the last: 5, 15, 25, 35… So 2 bubbles = 20, 3 = 45, 4 = 80, 10 = 500 (`5 × n²`). Bigger groups are worth much more.
- Bubbles above a popped group fall down. When a column is emptied, the remaining columns slide over to close the gap.
- **Classic** mode: the game ends when no groups of 2+ remain.
- End-of-board bonus (both modes): +100 for every bubble under 20 left, or +2,500 for clearing the board.
- **Levels** mode (10×10 board by default): your running total must reach a Fibonacci number of thousands — 1,000, 2,000, 3,000, 5,000, 8,000, 13,000… When you run out of moves, reaching the goal moves you on to the next level with a fresh board; otherwise you retry the level from your previous total. Progress is saved.
- **Settings** (gear icon) also lets you pick the bubble size: Small (14×16), Medium (12×14), Large (10×10) or Extra large (8×9). Each mode remembers its own size (Classic defaults to Medium, Levels to Large); level goals scale with the number of bubbles on the board.
- **Undo** reverts your last move; your best score is saved in the browser.

## Hosting on GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick the branch and the `/ (root)` folder, and save.
4. The game will be live at `https://<username>.github.io/<repo>/` within a minute or two.

To play locally, just open `index.html` in a browser.
