# Pipeline 🎲

A web app version of the **Pipeline** board game by Reiner Knizia.  
Play solo or multiplayer across multiple iPhones — no app install required.

## Setup

### 1. Firebase (for multiplayer)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Add a **Web app** → copy the config object
4. Go to **Build → Realtime Database** → Create database → Start in test mode
5. Open `index.html` and replace the `FIREBASE_CONFIG` block near the bottom with your config

### 2. GitHub Pages (hosting)

1. Push this repo to GitHub
2. Go to **Settings → Pages → Source** → select `gh-pages` branch (created automatically by the deploy action)
3. Your game is live at `https://YOUR-USERNAME.github.io/pipeline/`

### 3. Local testing (no Firebase)

Open `index.html` directly in a browser — Solo mode works without Firebase.  
For multiplayer locally, run a simple server:

```bash
npx serve .
```

## How to Play

- **Solo**: Enter your name, pick a sheet, tap "Solo Game"
- **Multiplayer**: One player creates a room and shares the 4-letter code; others tap "Join Room"

### Rules (quick)
- Each round: two dice are rolled automatically — all players place both pipe pieces on their own grid
- New pieces must connect (be adjacent) to at least one existing piece
- When a pipe opening faces a numbered grid edge, you score those points
- If you can't place any more pieces (no empty cells adjacent to existing pipes), you're done — others keep playing
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
