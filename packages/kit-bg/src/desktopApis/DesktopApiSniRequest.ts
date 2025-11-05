import { net } from 'electron';
import logger from 'electron-log/main';

import type {
  ISniRequestConfig,
  ISniResponse,
} from '@onekeyhq/shared/src/request/types/ipTable';

import type { IDesktopApi } from './instance/IDesktopApi';
import type { ClientRequest, IncomingMessage } from 'electron';

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
        // Build URL using IP address
        const protocol = 'https:';
        const port = config.port || 443;
        const url = `${protocol}//${config.ip}:${port}${config.path}`;

        logger.info('[DesktopApiSniRequest] Initiating SNI request', {
          hostname: config.hostname,
          ip: config.ip,
          port,
          path: config.path,
          method: config.method,
          url,
        });

        // Create request using Electron net module
        const request: ClientRequest = net.request({
          method: config.method,
          url,
          // Use persistent session for connection reuse
          partition: 'persist:sni-request',
        });

        // Set Host header to original domain (critical for SNI)
        request.setHeader('Host', config.hostname);
        logger.debug('[DesktopApiSniRequest] Set Host header', {
          host: config.hostname,
        });

        // Set additional headers
        if (config.headers) {
          Object.entries(config.headers).forEach(([key, value]) => {
            if (key.toLowerCase() !== 'host' && value != null) {
              request.setHeader(key, String(value));
            }
          });
        }

        // Set timeout if specified
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (config.timeout) {
          timeoutId = setTimeout(() => {
            request.abort();
            reject(new Error(`SNI Request timeout after ${config.timeout}ms`));
          }, config.timeout);
        }

        // Collect response data
        let responseData = '';
        const responseHeaders: Record<string, string> = {};
        let statusCode = 0;

        request.on('response', (response: IncomingMessage) => {
          statusCode = response.statusCode || 0;

          logger.info('[DesktopApiSniRequest] Received response', {
            hostname: config.hostname,
            ip: config.ip,
            statusCode,
          });

          // Collect response headers
          const { headers } = response;
          Object.keys(headers).forEach((key) => {
            const value = headers[key];
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

            logger.info(
              '[DesktopApiSniRequest] Request completed successfully',
              {
                hostname: config.hostname,
                ip: config.ip,
                statusCode,
                bodyLength: responseData.length,
              },
            );

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
            url,
            error: error.message,
            stack: error.stack,
          });
          reject(error);
        });

        // Send request body if present
        if (config.body) {
          logger.debug('[DesktopApiSniRequest] Sending request body', {
            bodyLength: config.body.length,
          });
          request.write(config.body);
        }

        // Send request
        logger.debug('[DesktopApiSniRequest] Sending request');
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
