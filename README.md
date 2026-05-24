# Pipeline 🎲

A web app version of the **Pipeline** board game by Reiner Knizia.  
Play solo or multiplayer across multiple iPhones — no app install required. This is only for private testing. Buy the board game!

## Setup

### 1. Firebase (for multiplayer)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Add a **Web app** → copy the config object
4. Go to **Build → Realtime Database** → Create database → Start in test mode
5. Add the config values as **GitHub Actions secrets** (see deployment section below)

### 2. GitHub Pages (hosting)

The deploy workflow (`.github/workflows/deploy.yml`) injects Firebase credentials from GitHub Secrets into `app.js` at build time — the `%%FIREBASE_*%%` placeholders are replaced automatically.

1. Add these secrets to your repo (**Settings → Secrets and variables → Actions**):
   - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_DATABASE_URL`
   - `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`
2. Push to `main` — the workflow deploys to the `gh-pages` branch
3. Enable Pages: **Settings → Pages → Source → gh-pages**
4. Your game is live at `https://YOUR-USERNAME.github.io/pipeline/`

### 3. Local testing (no Firebase)

Open `index.html` directly in a browser — Solo mode works without any server.  
For multiplayer locally, substitute your Firebase config values directly into `app.js` and run a simple server:

```bash
npx serve .
```

## How to Play

- **Solo**: Enter your name, pick a sheet, optionally toggle placement hints, tap "Solo Game"
- **Multiplayer**: One player creates a room and shares the 4-letter code (or QR); others tap "Join Room"
- **Play again**: After results, the host can start another round with the same players — cumulative wins are tracked for the session

### Rules (quick)
- Each round: two dice are rolled for all players — each player places both pipe pieces on their own grid
- A piece can go in any empty cell adjacent to at least one existing piece (including the pre-placed corner pieces)
- Tap an already-placed (green) piece to undo and re-place it; tap a die card to rotate it
- When a pipe opening faces a numbered grid edge, you score those points
- Score +10 bonus if all edge-1 openings are connected
- If you can't place any more pieces, you're done — others keep playing
- Game ends after 12 rounds (front sheet) or 14 rounds (back sheet), or when all players are stuck

### Solo Rating
| Score | Title |
|-------|-------|
| 40    | Pipeline-Profi 🏆 |
| 37–39 | Würfel-Champion 🎲 |
| 34–36 | Verbindungsperson 🔧 |
| 30–33 | Leitungslehrling 📐 |
| 20–29 | Kanalreiniger 🪣 |
| 0–19  | Rohrkrepierer 💥 |

## Firebase Security Rules

For production, update your Realtime Database rules:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```
