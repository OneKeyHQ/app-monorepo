import {
  openOAuthBrowser,
  startOAuthServer,
  stopOAuthServer,
} from '@onekeyhq/desktop/app/service/oauthLocalServer/oauthLocalServer';

import type { IDesktopApi } from './instance/IDesktopApi';

/**
 * Desktop API for OAuth Local Server
 *
 * Manages a local HTTP server for OAuth callback handling.
 * The server listens on a random port (127.0.0.1) to receive OAuth redirects
 * from external browsers (e.g., Google OAuth).
 */
class DesktopApiOAuthLocalServer {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  /**
   * Start OAuth local server on random port
   * @returns Promise resolving to server port
   */
  async startServer(): Promise<{ port: number }> {
    return startOAuthServer();
  }

  /**
   * Open OAuth URL in system browser
   * @param url OAuth authorization URL to open
   */
  async openBrowser(url: string): Promise<void> {
    return openOAuthBrowser(url);
  }

  /**
   * Stop OAuth local server
   */
  async stopServer(): Promise<void> {
    return stopOAuthServer();
  }
}

export default DesktopApiOAuthLocalServer;
