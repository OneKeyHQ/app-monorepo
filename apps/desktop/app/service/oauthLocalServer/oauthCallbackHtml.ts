/**
 * HTML templates returned by the localhost OAuth callback server (`/callback`).
 *
 * Why this exists:
 * - Supabase redirects back to `http://127.0.0.1:<port>/callback` with `code` (and `state`)
 *   in the URL query string (PKCE authorization code flow).
 * - We return an HTML page with JS to extract `code`/`state`, then POST them to `/complete`
 *   so the desktop app can validate state (anti-CSRF) and exchange the code for a session.
 *
 * Note:
 * - Browsers may block `window.close()` unless the tab/window was opened by script.
 *   We still attempt a best-effort close and provide a manual Close button.
 */

import { escape as escapeHtml } from 'lodash';

const OAUTH_CALLBACK_CLOSE_SCRIPT = `
  function clearUrlHash() {
    try {
      // Remove the URL hash without reloading the page, to avoid exposing tokens in the address bar.
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    } catch (e) {}
  }
  function tryClose() {
    clearUrlHash();
    try { window.close(); } catch (e) {}
    try { self.close(); } catch (e) {}
    try { window.open('', '_self'); window.close(); } catch (e) {}
  }
`;

export const OAUTH_CALLBACK_ERROR_HTML = (
  errorMessage: string,
) => `<!DOCTYPE html>
<html>
  <head>
    <title>Login Failed</title>
    <meta charset="utf-8">
  </head>
  <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
    <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
      <h1 style="color: #d32f2f; margin-bottom: 16px;">Login Failed</h1>
      <p style="color: #666;">Error: ${escapeHtml(errorMessage)}</p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">This tab may not close automatically due to browser restrictions. You can safely close it.</p>
      <button id="closeBtn" onclick="tryClose()" style="margin-top: 16px; padding: 10px 16px; border: 0; border-radius: 8px; background: #111; color: #fff; cursor: pointer;">Close</button>
    </div>
    <script>
      ${OAUTH_CALLBACK_CLOSE_SCRIPT}
      // Best-effort auto close (may be blocked by the browser).
      clearUrlHash();
      setTimeout(tryClose, 3000);
    </script>
  </body>
</html>
`;

export const OAUTH_CALLBACK_SUCCESS_HTML = `<!DOCTYPE html>
<html>
  <head>
    <title>Login Successful</title>
    <meta charset="utf-8">
  </head>
  <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
    <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
      <h1 style="color: #1a1a1a; margin-bottom: 16px;">Login Successful!</h1>
      <p style="color: #666; margin-bottom: 24px;">You can close this window and return to OneKey.</p>
      <div style="color: #999; font-size: 12px;">This tab may not close automatically due to browser restrictions. You can safely close it.</div>
      <button id="closeBtn" onclick="tryClose()" style="margin-top: 16px; padding: 10px 16px; border: 0; border-radius: 8px; background: #111; color: #fff; cursor: pointer;">Close</button>
    </div>
    <script>
      ${OAUTH_CALLBACK_CLOSE_SCRIPT}

      // PKCE flow: Extract authorization code from URL query string
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      // Clear URL query ASAP to avoid leaking code in the address bar.
      try {
        history.replaceState(null, document.title, window.location.pathname);
      } catch (e) {}

      if (code) {
        // Send authorization code to local server endpoint
        fetch('/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        }).then(() => {
          setTimeout(tryClose, 1500);
        }).catch(() => {
          setTimeout(tryClose, 1500);
        });
      } else {
        // No code found, close window
        setTimeout(tryClose, 1500);
      }
    </script>
  </body>
</html>
`;
