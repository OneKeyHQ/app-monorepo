## desktop-oauth-lab

Minimal repro for Google OAuth "Desktop app" **Authorization Code + PKCE** using **loopback + random port**.

### What this is for

- Verify whether Google token exchange (`/token`) works **without `client_secret`** for a Desktop OAuth client.
- Capture runtime evidence in OneKey's NDJSON ingest logs.

### Prerequisites

- Node.js with global `fetch` available (Node 18+).
- A Google OAuth **Desktop** client ID.

### Run

From repo root:

```bash
cd apps/desktop-oauth-lab
CLIENT_ID="YOUR_GOOGLE_OAUTH_DESKTOP_CLIENT_ID" node ./src/index.mjs
```

Options:

- `--no-open`: do not auto-open the browser. The script will print the URL.
- `CLIENT_SECRET`: optional. Do **NOT** commit secrets. This is only for A/B testing.

### Expected output

- Prints the auth URL and opens it (unless `--no-open`).
- Starts `http://127.0.0.1:{randomPort}/callback` listener.
- Exchanges `code` at `https://oauth2.googleapis.com/token`.
- Prints token exchange result or error (e.g. `client_secret is missing`).


