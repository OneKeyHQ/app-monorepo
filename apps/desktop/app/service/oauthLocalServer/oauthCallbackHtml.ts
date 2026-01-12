/**
 * HTML templates returned by the localhost OAuth callback server (`/oauth_callback_desktop`).
 *
 * Why this exists:
 * - Supabase redirects back to `http://127.0.0.1:<port>/oauth_callback_desktop` with `code` (and `state`)
 *   in the URL query string (PKCE authorization code flow).
 * - We return an HTML page with JS to extract `code`/`state`, then POST them to `/complete`
 *   so the desktop app can validate state (anti-CSRF) and exchange the code for a session.
 *
 * Note:
 * - Browsers may block `window.close()` unless the tab/window was opened by script.
 *   We still attempt a best-effort close and provide a manual Close button.
 *
 * Design tokens used (from Figma):
 * - Colors: text rgba(0,0,0,0.88), textSubdued rgba(0,0,0,0.61), bgStrong rgba(0,0,0,0.05)
 * - Font sizes: heading4xl 32px/40px, headingMd 16px/24px semibold, bodyLg 16px/24px
 * - Spacing: space-6 24px, space-2 8px, space-3.5 14px
 * - Border radius: radius-2 8px
 */

import { escape as escapeHtml } from 'lodash';

// OneKey logomark SVG (circular version with brand green)
const ONEKEY_LOGOMARK_SVG = `
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g clip-path="url(#clip0_23161_477)">
    <path
      d="M48 24C48 40.5685 40.5685 48 24 48C7.43146 48 0 40.5685 0 24C0 7.43146 7.43146 0 24 0C40.5685 0 48 7.43146 48 24Z"
      fill="#44D62C"
      style="fill:#44D62C;fill:color(display-p3 0.2667 0.8392 0.1725);fill-opacity:1;"
    />
    <path
      d="M26.1685 10.1768L19.4918 10.1768L18.3204 13.7186H22.0288V21.1793H26.1685V10.1768Z"
      fill="black"
      style="fill:black;fill-opacity:1;"
    />
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M31.6146 30.2086C31.6146 34.414 28.2055 37.8231 24.0001 37.8231C19.7948 37.8231 16.3857 34.414 16.3857 30.2086C16.3857 26.0033 19.7948 22.5942 24.0001 22.5942C28.2055 22.5942 31.6146 26.0033 31.6146 30.2086ZM28.1577 30.2086C28.1577 32.5048 26.2963 34.3662 24.0001 34.3662C21.704 34.3662 19.8426 32.5048 19.8426 30.2086C19.8426 27.9124 21.704 26.051 24.0001 26.051C26.2963 26.051 28.1577 27.9124 28.1577 30.2086Z"
      fill="black"
      style="fill:black;fill-opacity:1;"
    />
  </g>
  <defs>
    <clipPath id="clip0_23161_477">
      <rect
        width="48"
        height="48"
        fill="white"
        style="fill:white;fill-opacity:1;"
      />
    </clipPath>
  </defs>
</svg>
`;

// CSS styles following OneKey design tokens
const OAUTH_CALLBACK_STYLES = `
<style>
  :root {
    /* Colors - Light theme */
    --color-bg-app: #ffffff;
    --color-text: rgba(0, 0, 0, 0.88);
    --color-text-subdued: rgba(0, 0, 0, 0.61);
    --color-bg-strong: rgba(0, 0, 0, 0.05);
    --color-bg-strong-hover: rgba(0, 0, 0, 0.08);
    --color-bg-strong-active: rgba(0, 0, 0, 0.12);
    --color-critical: #dc2626;
    --color-critical-subdued: rgba(220, 38, 38, 0.1);

    /* Spacing */
    --space-2: 8px;
    --space-3: 12px;
    --space-3-5: 14px;
    --space-6: 24px;

    /* Border radius */
    --radius-2: 8px;

    /* Typography */
    --font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      /* Colors - Dark theme */
      --color-bg-app: #1a1a1a;
      --color-text: rgba(255, 255, 255, 0.88);
      --color-text-subdued: rgba(255, 255, 255, 0.61);
      --color-bg-strong: rgba(255, 255, 255, 0.08);
      --color-bg-strong-hover: rgba(255, 255, 255, 0.12);
      --color-bg-strong-active: rgba(255, 255, 255, 0.16);
      --color-critical: #f87171;
      --color-critical-subdued: rgba(248, 113, 113, 0.15);
    }
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: var(--font-family);
    background: var(--color-bg-app);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .container {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    width: 400px;
    padding: 0 var(--space-6);
  }

  .logo {
    width: 48px;
    height: 48px;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-bottom: 22px;
  }

  .title {
    font-size: 32px;
    font-weight: 600;
    line-height: 40px;
    letter-spacing: 0.38px;
    color: var(--color-text);
  }

  .title--error {
    color: var(--color-critical);
  }

  .subtitle {
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    letter-spacing: -0.32px;
    color: var(--color-text);
  }

  .description {
    font-size: 16px;
    font-weight: 400;
    line-height: 24px;
    letter-spacing: -0.32px;
    color: var(--color-text-subdued);
  }

  .button-container {
    padding-top: var(--space-2);
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: 7px 15px;
    background: var(--color-bg-strong);
    border: 1px solid transparent;
    border-radius: var(--radius-2);
    font-family: var(--font-family);
    font-size: 16px;
    font-weight: 500;
    line-height: 24px;
    letter-spacing: -0.32px;
    color: var(--color-text);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .button:hover {
    background: var(--color-bg-strong-hover);
  }

  .button:active {
    background: var(--color-bg-strong-active);
  }

  .error-box {
    background: var(--color-critical-subdued);
    border-radius: var(--radius-2);
    padding: var(--space-3);
    margin-top: var(--space-2);
  }

  .error-message {
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: var(--color-critical);
    word-break: break-word;
  }
</style>
`;

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
<html lang="en">
  <head>
    <title>Login Failed</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${OAUTH_CALLBACK_STYLES}
  </head>
  <body>
    <div class="container">
      <div class="logo">
        ${ONEKEY_LOGOMARK_SVG}
      </div>
      <div class="content">
        <h1 class="title title--error">Login failed</h1>
        <p class="subtitle">Something went wrong during login.</p>
        <div class="error-box">
          <p class="error-message">${escapeHtml(errorMessage)}</p>
        </div>
        <p class="description">Click the button below if this window does not close automatically.</p>
        <div class="button-container">
          <button class="button" id="closeBtn" onclick="tryClose()">Close window</button>
        </div>
      </div>
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
