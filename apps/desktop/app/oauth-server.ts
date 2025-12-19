import { createServer } from 'http';

import { shell } from 'electron';

import { OAUTH_CALLBACK_DESKTOP_CHANNEL } from '@onekeyhq/shared/src/consts/authConsts';

import type { BrowserWindow } from 'electron';
import type { Server } from 'http';

let oauthServer: Server | null = null;

// Get main window reference (will be set from app.ts)
let mainWindow: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null) {
  mainWindow = window;
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
const OAUTH_PORTS = [19_185, 19_285, 19_385, 19_485, 19_585];

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

        // Handle callback from OAuth (Supabase redirects back to localhost with tokens in URL hash)
        if (url.pathname === '/callback') {
          // Tokens are in URL hash (not sent to server), so we return HTML with JS to extract them.
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

          // Return HTML page that extracts tokens from URL hash and sends to server
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
                // Extract tokens from URL hash
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');
                const idToken = params.get('id_token');
                
                if (accessToken && refreshToken) {
                  // Send tokens to local server endpoint
                  fetch('/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessToken, refreshToken, idToken }),
                  }).then(() => {
                    setTimeout(() => window.close(), 2000);
                  }).catch(() => {
                    setTimeout(() => window.close(), 2000);
                  });
                } else {
                  // No tokens found, close window
                  setTimeout(() => window.close(), 2000);
                }
              </script>
            </body>
          </html>
        `);
        } else if (url.pathname === '/complete' && req.method === 'POST') {
          // Receive tokens from browser JS
          let body = '';
          req.on('data', (chunk) => {
            body += (chunk as Buffer).toString();
          });
          req.on('end', () => {
            try {
              const { accessToken, refreshToken, idToken } = JSON.parse(
                body,
              ) as {
                accessToken: string;
                refreshToken: string;
                idToken?: string;
              };

              if (
                accessToken &&
                refreshToken &&
                mainWindow &&
                !mainWindow.isDestroyed()
              ) {
                // Send tokens to renderer process
                mainWindow.webContents.send(OAUTH_CALLBACK_DESKTOP_CHANNEL, {
                  accessToken,
                  refreshToken,
                  idToken,
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
  await shell.openExternal(url);
}

export async function stopOAuthServer(): Promise<void> {
  if (oauthServer) {
    oauthServer.close();
    oauthServer = null;
  }
}
