# ⚽ Nearest Club

A simple browser game. You're given a random town in England and have to guess
which of the 92 English league clubs (Premier League + EFL, 2025-26 season)
plays nearest to it.

**Play it live:** _(URL added after deployment)_

## How it works

- Pick a club from the searchable dropdown and hit **Guess**.
- The game computes the straight-line ("as the crow flies") distance from the
  town to every club's stadium and tells you the true nearest club.
- If you're wrong, it shows how your pick ranked and how much further it was.
- Score, accuracy and streaks are tracked and saved in your browser.

## Running locally

It's a static site — no build step, no server needed. Just open `index.html`
in a browser.

## Project structure

| File | Purpose |
|------|---------|
| `index.html` | Page markup |
| `styles.css` | Styling |
| `app.js` | Game logic (random town, distance calc, scoring) |
| `data/clubs.js` | The 92 clubs with stadium coordinates |
| `data/towns.js` | ~165 English towns with coordinates |

## Notes

Club and division membership is for the 2025-26 season. After each season's
promotions and relegations, refresh `data/clubs.js` to keep it accurate.
Coordinates are approximate but precise enough that nearest-club results are
reliable.
