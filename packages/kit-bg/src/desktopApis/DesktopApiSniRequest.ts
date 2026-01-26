import https from 'https';
import zlib from 'zlib';

import logger from 'electron-log/main';

import type {
  ISniRequestConfig,
  ISniResponse,
} from '@onekeyhq/shared/src/request/types/ipTable';

import type { IDesktopApi } from './instance/IDesktopApi';
import type { Readable } from 'stream';

/**
 * Create a custom HTTPS agent that uses hostname+IP combination as connection pool keys.
 * This ensures:
 * - Different IPs for the same hostname are isolated (accurate speed testing)
 * - Same hostname+IP combination can reuse connections (performance optimization)
 */
function createCustomAgent(): https.Agent {
  // Create agent with custom getName to use hostname+IP as pool key
  const agent = new https.Agent({
    keepAlive: true, // Enable TCP keep-alive
    keepAliveMsecs: 30_000, // Send keep-alive probes every 30 seconds
    maxSockets: Infinity, // No limit on concurrent connections per host (browser behavior)
    maxFreeSockets: 256, // Keep more idle connections for reuse (Chrome default)
    timeout: 60_000, // Socket timeout (60 seconds)
    scheduling: 'lifo', // Use most recently used socket first (better for keep-alive)
  });

  // Override getName to use both hostname and IP as pool key
  // This ensures that:
  // 1. Different IPs are isolated (accurate speed testing)
  // 2. Same hostname+IP combination can reuse connections (performance optimization)
  // @ts-expect-error
  agent.getName = (options: https.RequestOptions): string => {
    const ip = options.host || '';
    const hostname = options.servername || '';
    const port = options.port || 443;

    // Use hostname:IP:port as the connection pool key
    // This prevents connection reuse across different IPs for the same hostname
    const poolKey = `${hostname}:${ip}:${port}`;

    return poolKey;
  };
  return agent;
}

class DesktopApiSniRequest {
  constructor({ desktopApi }: { desktopApi: IDesktopApi }) {
    this.desktopApi = desktopApi;
    this.agent = createCustomAgent();
  }

  desktopApi: IDesktopApi;

  // Custom HTTPS agent for connection reuse
  private agent: https.Agent;

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
          // Use custom agent for connection reuse
          agent: this.agent,
          // Ensure SSL/TLS validation
          rejectUnauthorized: true,
        };

        // Collect response data
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

          // Handle response decompression based on content-encoding
          let responseStream: Readable = response;
          const encoding = response.headers['content-encoding'];

          if (encoding === 'gzip') {
            responseStream = response.pipe(zlib.createGunzip());
          } else if (encoding === 'deflate') {
            responseStream = response.pipe(zlib.createInflate());
          } else if (encoding === 'br') {
            responseStream = response.pipe(zlib.createBrotliDecompress());
          }

          // Collect decompressed response data as Buffer chunks
          const chunks: Buffer[] = [];
          responseStream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          responseStream.on('end', () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            // Concatenate all chunks and convert to UTF-8 string
            const responseData = Buffer.concat(chunks).toString('utf8');

            resolve({
              statusCode,
              headers: responseHeaders,
              body: responseData,
            });
          });

          responseStream.on('error', (error: Error) => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            logger.error('[DesktopApiSniRequest] Response stream error', {
              hostname: config.hostname,
              ip: config.ip,
              encoding,
              error: error.message,
            });
            reject(new Error(`Response stream error: ${error.message}`));
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
