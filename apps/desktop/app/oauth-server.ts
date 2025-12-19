import { createServer } from 'http';

import { shell } from 'electron';

import { OAUTH_CALLBACK_DESKTOP_CHANNEL } from '@onekeyhq/shared/src/consts/oauthConsts';

import type { BrowserWindow } from 'electron';
import type { Server } from 'http';

let oauthServer: Server | null = null;

// Get main window reference (will be set from app.ts)
let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null) {
  mainWindow = window;
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

      // Handle callback from Google OAuth
      if (url.pathname === '/callback') {
        // For Desktop Application type with response_type=code,
        // Google returns authorization code in URL query parameters (not hash)
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          // OAuth error occurred
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
          });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Login Failed</title>
                <meta charset="utf-8">
              </head>
              <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
                <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
                  <h1 style="color: #d32f2f; margin-bottom: 16px;">Login Failed</h1>
                  <p style="color: #666;">Error: ${error}</p>
                  <p style="color: #999; font-size: 12px; margin-top: 24px;">This window will close automatically...</p>
                </div>
                <script>
                  setTimeout(() => window.close(), 3000);
                </script>
              </body>
            </html>
          `);
          return;
        }

        if (code && mainWindow && !mainWindow.isDestroyed()) {
          // Send authorization code to renderer process
          // The renderer will exchange it for id_token using PKCE
          mainWindow.webContents.send(OAUTH_CALLBACK_DESKTOP_CHANNEL, {
            code,
          });

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
          });
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Login Successful</title>
                <meta charset="utf-8">
              </head>
              <body style="font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
                <div style="background: white; padding: 40px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
                  <h1 style="color: #1a1a1a; margin-bottom: 16px;">Login Successful!</h1>
                  <p style="color: #666; margin-bottom: 24px;">You can close this window and return to OneKey.</p>
                  <div style="color: #999; font-size: 12px;">This window will close automatically...</div>
                </div>
                <script>
                  setTimeout(() => window.close(), 2000);
                </script>
              </body>
            </html>
          `);

          // Close server after receiving callback
          setTimeout(() => {
            oauthServer?.close();
            oauthServer = null;
          }, 1000);
        } else {
          // No code received
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('No authorization code received');
        }
      } else {
        // 404 for other paths
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    // Listen on random available port, bind to 127.0.0.1 for security
    oauthServer.listen(0, '127.0.0.1', () => {
      const address = oauthServer?.address();
      const port =
        typeof address === 'object' && address !== null ? address.port : 0;
      resolve({ port });
    });

    oauthServer.on('error', (error) => {
      reject(error);
    });

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
  await shell.openExternal(url);
}

export async function stopOAuthServer(): Promise<void> {
  if (oauthServer) {
    oauthServer.close();
    oauthServer = null;
  }
}
