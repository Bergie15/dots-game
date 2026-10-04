# Bubble Breaker

A browser remake of the classic Android *Bubble Breaker* game. Plain HTML/CSS/JS — no build step — so it runs directly on GitHub Pages.

## How to play

- Tap a group of **2 or more** touching bubbles of the same color (up/down/left/right).
- In **2-tap** mode (default) the first tap highlights the group and shows its value; tap it again to pop. Switch to **1-tap** with the button in the top-right.
- A group of `n` bubbles scores `n × (n − 1)` points, so bigger groups are worth much more.
- Bubbles above a popped group fall down. When a column is emptied, the remaining columns slide over to close the gap.
- The game ends when no groups of 2+ remain. Clear the board for a 1000 point bonus (or a smaller bonus with fewer than 5 left).
- **UNDO** reverts your last move; your best score is saved in the browser.

## Hosting on GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick the branch and the `/ (root)` folder, and save.
4. The game will be live at `https://<username>.github.io/<repo>/` within a minute or two.

To play locally, just open `index.html` in a browser.
