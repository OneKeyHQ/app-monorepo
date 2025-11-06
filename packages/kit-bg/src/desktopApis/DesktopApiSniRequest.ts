import https from 'https';

import logger from 'electron-log/main';

import type {
  ISniRequestConfig,
  ISniResponse,
} from '@onekeyhq/shared/src/request/types/ipTable';

import type { IDesktopApi } from './instance/IDesktopApi';

class DesktopApiSniRequest {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
  }

  desktopApi: IDesktopApi;

  /**
   * Execute SNI request using Electron net module
   * Implements IP direct connection with SNI support
   *
   * @param config SNI request configuration
   * @returns Promise resolving to SNI response
   */
  async request(config: ISniRequestConfig): Promise<ISniResponse> {
    return new Promise((resolve, reject) => {
      try {
        const port = config.port || 443;

        // Build request options for Node.js https module
        const requestOptions: https.RequestOptions = {
          method: config.method,
          host: config.ip, // Use IP for direct connection
          port,
          path: config.path,
          servername: config.hostname, // CRITICAL: SNI must use domain name for TLS handshake
          headers: {
            Host: config.hostname, // Set Host header to original domain
            ...config.headers,
          },
          // Ensure SSL/TLS validation
          rejectUnauthorized: true,
        };

        // Collect response data
        let responseData = '';
        const responseHeaders: Record<string, string> = {};
        let statusCode = 0;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        // Create HTTPS request
        const request = https.request(requestOptions, (response) => {
          statusCode = response.statusCode || 0;

          // Collect response headers
          Object.keys(response.headers).forEach((key) => {
            const value = response.headers[key];
            if (value) {
              responseHeaders[key] = Array.isArray(value)
                ? value.join(', ')
                : value;
            }
          });

          // Collect response data
          response.on('data', (chunk: Buffer) => {
            responseData += chunk.toString('utf8');
          });

          response.on('end', () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            resolve({
              statusCode,
              headers: responseHeaders,
              body: responseData,
            });
          });

          response.on('error', (error: Error) => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            logger.error('[DesktopApiSniRequest] Response error', {
              hostname: config.hostname,
              ip: config.ip,
              error: error.message,
            });
            reject(new Error(`Response error: ${error.message}`));
          });
        });

        request.on('error', (error: Error) => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          logger.error('[DesktopApiSniRequest] Request failed', {
            hostname: config.hostname,
            ip: config.ip,
            error: error.message,
            stack: error.stack,
          });
          reject(error);
        });

        // Set timeout if specified
        if (config.timeout) {
          timeoutId = setTimeout(() => {
            request.destroy();
            reject(new Error(`SNI Request timeout after ${config.timeout}ms`));
          }, config.timeout);
        }

        // Send request body if present
        if (config.body) {
          request.write(config.body);
        }

        // Send request
        request.end();
      } catch (error) {
        logger.error('[DesktopApiSniRequest] Failed to create request', {
          hostname: config.hostname,
          ip: config.ip,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        reject(error);
      }
    });
  }

  /**
   * Check if SNI is supported
   * Always returns true in Electron environment
   *
   * @returns Promise resolving to true
   */
  async isSupported(): Promise<boolean> {
    return true;
  }
}

export default DesktopApiSniRequest;
