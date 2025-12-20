import { spawn } from 'child_process';
import { createServer } from 'http';

import { app, shell } from 'electron';

import {
  OAUTH_CALLBACK_DESKTOP_CHANNEL,
  OAUTH_POPUP_HEIGHT,
  OAUTH_POPUP_WIDTH,
} from '@onekeyhq/shared/src/consts/authConsts';

import {
  OAUTH_CALLBACK_ERROR_HTML,
  OAUTH_CALLBACK_SUCCESS_HTML,
} from './oauthCallbackHtml';

import type { BrowserWindow } from 'electron';
import type { Server } from 'http';

let oauthServer: Server | null = null;

// Get main window reference (will be set from app.ts)
let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null) {
  mainWindow = window;
}

function getDefaultBrowserNameForUrl(url: string): string {
  try {
    return app.getApplicationNameForProtocol(url) || '';
  } catch (e) {
    return '';
  }
}

function isChromiumBasedBrowser(appName: string): boolean {
  const n = (appName || '').toLowerCase();
  return (
    n.includes('chrome') ||
    n.includes('chromium') ||
    n.includes('edge') ||
    n.includes('brave') ||
    n.includes('vivaldi')
  );
}

function getChromiumBinForWindows(appName: string): string | null {
  const n = (appName || '').toLowerCase();
  if (n.includes('edge')) {
    return 'msedge';
  }
  if (n.includes('brave')) {
    return 'brave';
  }
  if (n.includes('vivaldi')) {
    return 'vivaldi';
  }
  // Default to chrome if the handler looks like Chrome/Chromium.
  if (n.includes('chrome') || n.includes('chromium')) {
    return 'chrome';
  }
  return null;
}

function getChromiumBinsForLinux(appName: string): string[] {
  const n = (appName || '').toLowerCase();
  if (n.includes('brave')) {
    return ['brave-browser', 'brave'];
  }
  if (n.includes('vivaldi')) {
    return ['vivaldi', 'vivaldi-stable'];
  }
  if (n.includes('edge')) {
    return ['microsoft-edge', 'microsoft-edge-stable'];
  }
  // Chrome/Chromium defaults
  return [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ];
}

const shouldOpenChromeAppWindow = false;
function tryOpenChromeAppWindow(url: string): boolean {
  const width = OAUTH_POPUP_WIDTH;
  const height = OAUTH_POPUP_HEIGHT;
  // Note: --window-size must come BEFORE --app, and --new-window helps when Chrome is already running
  const commonArgs = [
    // '--new-window',
    `--window-size=${width},${height}`,
    `--app=${url}`,
  ];

  try {
    const handlerName = getDefaultBrowserNameForUrl(url);
    // Only use Chromium "app window" mode when the user's default browser is Chromium-based.
    // Otherwise we should respect the default browser to reuse their existing login state.
    if (!isChromiumBasedBrowser(handlerName)) {
      return false;
    }

    if (process.platform === 'darwin') {
      // macOS: open the default handler (Chrome/Chromium/Edge/Brave...) in app mode.
      const child = spawn(
        '/usr/bin/open',
        ['-na', handlerName, '--args', ...commonArgs],
        {
          detached: true,
          stdio: 'ignore',
        },
      );
      // eslint-disable-next-line spellcheck/spell-checker
      child.unref();
      return true;
    }

    if (process.platform === 'win32') {
      // Windows: best-effort. Only attempt known Chromium executable names. Fallback to default browser.
      const bin = getChromiumBinForWindows(handlerName);
      if (!bin) {
        return false;
      }
      const child = spawn(
        'cmd.exe',
        ['/c', 'start', '""', bin, ...commonArgs],
        {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        },
      );
      // eslint-disable-next-line spellcheck/spell-checker
      child.unref();
      return true;
    }

    // Linux: try common executable names
    const candidates = getChromiumBinsForLinux(handlerName);
    for (const bin of candidates) {
      try {
        const child = spawn(bin, commonArgs, {
          detached: true,
          stdio: 'ignore',
        });
        // eslint-disable-next-line spellcheck/spell-checker
        child.unref();
        return true;
      } catch (e) {
        // Try next candidate
      }
    }
  } catch (e) {
    // Ignore and fallback to default browser.
  }

  return false;
}

// Fixed port range for OAuth callback
// Web Application type requires explicit port configuration in Google Cloud Console
// These ports must be added to Authorized redirect URIs:
// http://localhost:19185/callback
// http://localhost:19285/callback
// http://localhost:19385/callback
// http://localhost:19485/callback
// http://localhost:19585/callback
// http://127.0.0.1:19185/callback
// http://127.0.0.1:19285/callback
// http://127.0.0.1:19385/callback
// http://127.0.0.1:19485/callback
// http://127.0.0.1:19585/callback
const OAUTH_PORTS = [
  19_185, 19_285, 19_385, 19_485, 19_585,
  //
];

// Export functions for DesktopApiOAuth to use
export async function startOAuthServer(): Promise<{ port: number }> {
  return new Promise((resolve, reject) => {
    // Close existing server if any
    if (oauthServer) {
      oauthServer.close();
      oauthServer = null;
    }

    // Try each port in sequence until one is available
    let portIndex = 0;
    const startIndex = Math.floor(Math.random() * OAUTH_PORTS.length);

    const tryStartServer = (): void => {
      if (portIndex >= OAUTH_PORTS.length) {
        reject(new Error('All OAuth ports are occupied'));
        return;
      }

      const port = OAUTH_PORTS[(startIndex + portIndex) % OAUTH_PORTS.length];
      oauthServer = createServer((req, res) => {
        const url = new URL(req.url || '/', 'http://localhost');

        // Handle callback from OAuth (Supabase redirects back to localhost with authorization code in URL query)
        if (url.pathname === '/callback') {
          // PKCE flow: authorization code is in URL query string (not hash)
          const error = url.searchParams.get('error');

          if (error) {
            // OAuth error occurred
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
            });
            res.end(OAUTH_CALLBACK_ERROR_HTML(error));
            return;
          }

          // Return HTML page that extracts code from URL query and sends to server
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
          });
          res.end(OAUTH_CALLBACK_SUCCESS_HTML);
        } else if (url.pathname === '/complete' && req.method === 'POST') {
          // Receive authorization code from browser JS
          let body = '';
          req.on('data', (chunk) => {
            body += (chunk as Buffer).toString();
          });
          req.on('end', () => {
            try {
              const { code, state } = JSON.parse(body) as {
                code: string;
                state?: string;
              };

              if (code && mainWindow && !mainWindow.isDestroyed()) {
                // Send authorization code to renderer process
                mainWindow.webContents.send(OAUTH_CALLBACK_DESKTOP_CHANNEL, {
                  code,
                  state,
                });
              }

              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('OK');

              // Close server after receiving callback
              setTimeout(() => {
                oauthServer?.close();
                oauthServer = null;
              }, 1000);
            } catch (error) {
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end('Invalid request');
            }
          });
        } else {
          // 404 for other paths
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      // Try to listen on the current port
      oauthServer.listen(port, '127.0.0.1', () => {
        resolve({ port });
      });

      // eslint-disable-next-line spellcheck/spell-checker
      oauthServer.on('error', (error: NodeJS.ErrnoException) => {
        // If port is in use, try next port
        if (error.code === 'EADDRINUSE') {
          oauthServer?.close();
          oauthServer = null;
          portIndex += 1;
          tryStartServer();
        } else {
          reject(error);
        }
      });
    };

    // Start trying ports
    tryStartServer();

    // Auto-close server after 5 minutes timeout
    setTimeout(() => {
      if (oauthServer) {
        oauthServer.close();
        oauthServer = null;
      }
    }, 5 * 60 * 1000);
  });
}

export async function openOAuthBrowser(url: string): Promise<void> {
  // We prefer opening the **system browser** (to reuse existing login state/cookies),
  // but we can't reliably remove the address bar or control window size for the default browser.
  // Best-effort: try Chromium "app window" mode (`--app=...`) which usually has no address bar,
  // and supports `--window-size`. Fallback to default browser.
  const opened = shouldOpenChromeAppWindow
    ? tryOpenChromeAppWindow(url)
    : false;
  if (!opened) {
    await shell.openExternal(url);
  }
}

export async function stopOAuthServer(): Promise<void> {
  if (oauthServer) {
    oauthServer.close();
    oauthServer = null;
  }
}
