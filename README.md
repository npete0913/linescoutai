# Line Scout AI — Deploy Instructions

## Files
```
linescoutai/
├── index.html                    ← Main app
├── netlify.toml                  ← Netlify config
├── netlify/
│   └── functions/
│       └── odds.js               ← Serverless function (hides your API key)
└── README.md
```

## Deploy Steps

### 1. Add your Odds API key to Netlify
- Go to Netlify → Your Site → Site Configuration → Environment Variables
- Click "Add a variable"
- Key: `ODDS_API_KEY`
- Value: your key from the-odds-api.com
- Click Save

### 2. Deploy via Netlify CLI (recommended)
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### 2. OR drag-and-drop deploy
- Zip the entire `linescoutai` folder
- Go to Netlify → Your Site → Deploys → Drag & Drop

### 3. Done
Visit linescoutai.com — the site will work for all visitors without needing an API key.

## Notes
- The Odds API key is stored as an environment variable, never exposed in the browser
- Free tier: 500 requests/month. Pro tier ($29/mo): 20,000 requests/month
- Odds data from DraftKings, FanDuel, BetMGM, and Caesars
