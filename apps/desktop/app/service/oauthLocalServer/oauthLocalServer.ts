import { spawn } from 'child_process';
import { createServer } from 'http';

import { app, shell } from 'electron';

import {
  OAUTH_CALLBACK_DESKTOP_CHANNEL,
  OAUTH_CALLBACK_DESKTOP_PATH,
  OAUTH_POPUP_HEIGHT,
  OAUTH_POPUP_WIDTH,
} from '@onekeyhq/shared/src/consts/authConsts';

import { getLocale } from '../../i18n';

import { OAUTH_CALLBACK_ERROR_HTML } from './oauthCallbackHtml';

import type { BrowserWindow } from 'electron';
import type { Server } from 'http';

let oauthServer: Server | null = null;

// Get main window reference (will be set from app.ts)
let mainWindow: BrowserWindow | null = null;

export function setMainWindowForOAuthServer(window: BrowserWindow | null) {
  mainWindow = window;
}

function getDefaultBrowserNameForUrl(url: string): string {
  try {
    return app.getApplicationNameForProtocol(url) || '';
  } catch (_e) {
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
        child.unref();
        return true;
      } catch (_e) {
        // Try next candidate
      }
    }
  } catch (_e2) {
    // Ignore and fallback to default browser.
  }

  return false;
}

// Export functions for DesktopApiOAuth to use
export async function startOAuthServer(): Promise<{ port: number }> {
  return new Promise((resolve, reject) => {
    // Close existing server if any
    if (oauthServer) {
      oauthServer.close();
      oauthServer = null;
    }

    oauthServer = createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');

      // Handle callback from OAuth (Supabase redirects back to localhost with authorization code in URL query)
      if (url.pathname === OAUTH_CALLBACK_DESKTOP_PATH) {
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

        // Extract authorization code directly from URL query
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const oneKeyState = url.searchParams.get('onekey_oauth_state');

        if (code && mainWindow && !mainWindow.isDestroyed()) {
          // Send authorization code to renderer process
          mainWindow.webContents.send(OAUTH_CALLBACK_DESKTOP_CHANNEL, {
            code,
            state,
            oneKeyState,
          });
        }

        // Get current locale and redirect to login page
        const locale = getLocale();
        const redirectUrl = `https://login.onekeytest.com/?locale=${encodeURIComponent(
          locale,
        )}`;

        res.writeHead(302, { Location: redirectUrl });
        res.end();

        // Close server after redirecting
        setTimeout(() => {
          oauthServer?.close();
          oauthServer = null;
        }, 1000);
      } else {
        // 404 for other paths
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    // Use listen(0) to let the system automatically assign an available port
    oauthServer.listen(0, '127.0.0.1', () => {
      const address = oauthServer?.address();
      if (address && typeof address === 'object' && address.port) {
        resolve({ port: address.port });
      } else {
        reject(new Error('Failed to get assigned port from server'));
      }
    });

    oauthServer.on('error', (error: NodeJS.ErrnoException) => {
      reject(error);
    });

    // Auto-close server after 5 minutes timeout
    setTimeout(
      () => {
        if (oauthServer) {
          oauthServer.close();
          oauthServer = null;
        }
      },
      5 * 60 * 1000,
    );
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
