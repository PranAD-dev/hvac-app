# Composio Gmail Integration

## Architecture

```
HVAC Expo App  -->  Express Server (localhost:3001)  -->  Composio SDK  -->  Gmail API
```

The Composio SDK runs on a Node.js backend (not in React Native). The Expo app calls the backend via REST.

## Setup

### 1. Composio Account
- Sign up at https://app.composio.dev
- Copy your API key

### 2. Server Environment
```bash
cd server
cp .env.example .env
# Add your COMPOSIO_API_KEY
```

### 3. Start the Server
```bash
cd server
npm install
node index.js
# Runs on http://localhost:3001
```

### 4. Connect Gmail
- In the app, open any job with a service report
- Tap "Email Report"
- If Gmail isn't connected, you'll be prompted to authenticate via Google OAuth
- After auth, the server stores the connection for future use

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/gmail/status` | GET | Check if Gmail is connected |
| `/gmail/connect` | POST | Start OAuth flow, returns `redirectUrl` |
| `/gmail/callback` | GET | OAuth callback (shows success page) |
| `/gmail/send` | POST | Send email via Gmail |

### Send Email Request
```json
POST /gmail/send
{
  "recipient_email": "manager@company.com",
  "subject": "HVAC Service Report — John Smith",
  "body": "Service Report\nJohn Smith — 123 Main St\n\n..."
}
```

### Send Email Response
```json
{
  "success": true,
  "data": { "message_id": "..." }
}
```

## How It Works

1. **Composio SDK** (`@composio/core`) manages OAuth tokens and API calls
2. **Entity ID** `hvac-tech-01` identifies the technician's connected accounts
3. **`GMAIL_SEND_EMAIL`** is a Composio tool that wraps the Gmail API
4. The server handles all auth state — the Expo app just calls REST endpoints

## Dependencies

### Server (`server/`)
- `@composio/core` — Composio SDK
- `express` — HTTP server
- `cors` — Cross-origin requests from Expo
- `dotenv` — Environment variables

### App
- `expo-web-browser` — Opens OAuth in a browser for Gmail connection

## Extending

To add more Composio tools (Slack, Google Calendar, etc.):

1. Add a new auth endpoint in `server/index.js`:
   ```js
   app.post("/slack/connect", async (req, res) => { ... });
   ```

2. Add execution endpoints:
   ```js
   app.post("/slack/send", async (req, res) => {
     await composio.tools.execute("SLACK_SENDS_A_MESSAGE", { ... });
   });
   ```

3. Reference: https://docs.composio.dev for available tools and parameters
