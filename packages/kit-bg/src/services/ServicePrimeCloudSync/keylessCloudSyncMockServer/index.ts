import crypto from 'crypto';
import http from 'http';

import * as secp256k1 from '@noble/secp256k1';
import safeStringify from 'fast-safe-stringify';

import { KeylessCloudSyncMockStore } from './keylessCloudSyncMockStore';

import type {
  IApiClientResponse,
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncDownloadPostData,
  ICloudSyncUploadPostData,
} from './types';

export type IKeylessCloudSyncMockServerOptions = {
  host?: string;
  port?: number;
};

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 17_921;

// Replay attack protection
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
const usedNonces = new Map<string, number>(); // nonce -> timestamp

const store = new KeylessCloudSyncMockStore();

/**
 * Clean up expired nonces (older than TIMESTAMP_TOLERANCE_MS)
 */
const cleanupExpiredNonces = (): void => {
  const now = Date.now();
  const expiredNonces: string[] = [];

  for (const [nonce, timestamp] of usedNonces.entries()) {
    if (now - timestamp > TIMESTAMP_TOLERANCE_MS) {
      expiredNonces.push(nonce);
    }
  }

  for (const nonce of expiredNonces) {
    usedNonces.delete(nonce);
  }

  // Expired nonces cleaned up silently
};

/**
 * Verify timestamp and nonce to prevent replay attacks
 *
 * @returns true if valid, error message if invalid
 */
const verifyTimestampAndNonce = (
  timestamp: number,
  nonce: string,
): { valid: boolean; error?: string } => {
  const now = Date.now();

  // Check timestamp is within acceptable range
  const timeDiff = Math.abs(now - timestamp);
  if (timeDiff > TIMESTAMP_TOLERANCE_MS) {
    return {
      valid: false,
      error: `Timestamp out of range: ${timeDiff}ms (max: ${TIMESTAMP_TOLERANCE_MS}ms)`,
    };
  }

  // Check timestamp is not from the future (with small tolerance for clock skew)
  const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000; // 1 minute
  if (timestamp > now + CLOCK_SKEW_TOLERANCE_MS) {
    return {
      valid: false,
      error: `Timestamp is from the future: ${timestamp - now}ms ahead`,
    };
  }

  // Check nonce hasn't been used before
  if (usedNonces.has(nonce)) {
    return {
      valid: false,
      error: `Nonce has already been used: ${nonce}`,
    };
  }

  // Record this nonce as used
  usedNonces.set(nonce, timestamp);

  // Periodically clean up expired nonces
  if (usedNonces.size % 100 === 0) {
    cleanupExpiredNonces();
  }

  return { valid: true };
};

const getHeaderValue = (
  req: http.IncomingMessage,
  headerName: string,
): string | undefined => {
  const value = req.headers[headerName.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const readJsonBody = async (req: http.IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  const bodyText = Buffer.concat(chunks).toString('utf8');
  if (!bodyText) {
    return {};
  }
  return JSON.parse(bodyText) as unknown;
};

/**
 * Deterministic JSON serialization (uses fast-safe-stringify, same as client)
 */
const stableStringify = (obj: unknown): string => {
  return safeStringify.stableStringify(obj);
};

/**
 * Parse Base64-encoded signature header
 */
const parseSignatureHeader = (
  signatureHeader: string,
): {
  publicKey: string;
  signature: string;
  timestamp: number;
  nonce: string;
} | null => {
  try {
    const decoded = Buffer.from(signatureHeader, 'base64').toString('utf8');
    return JSON.parse(decoded) as {
      publicKey: string;
      signature: string;
      timestamp: number;
      nonce: string;
    };
  } catch {
    return null;
  }
};

/**
 * Compute SHA256 hash of data
 */
const computeDataHash = (data: string): string => {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
};

/**
 * Verify signature using secp256k1
 *
 * IMPORTANT: dataHash is REQUIRED for all endpoints to prevent request tampering.
 * Never make dataHash optional in production - it ensures the signature is bound
 * to the specific request data and prevents replay attacks with modified payloads.
 */
const verifySignature = async ({
  publicKey,
  signature,
  timestamp,
  nonce,
  dataHash,
}: {
  publicKey: string;
  signature: string;
  timestamp: number;
  nonce: string;
  dataHash: string; // REQUIRED - not optional!
}): Promise<{ valid: boolean; error?: string }> => {
  try {
    // Step 1: Verify timestamp and nonce to prevent replay attacks
    const replayCheck = verifyTimestampAndNonce(timestamp, nonce);
    if (!replayCheck.valid) {
      console.warn('[MockServer] Replay attack detected:', replayCheck.error);
      return { valid: false, error: replayCheck.error };
    }

    // Step 2: Reconstruct the sign message (same as client-side buildKeylessSignatureHeader)
    // dataHash MUST be included to bind signature to specific request data
    const signMessage = {
      timestamp,
      nonce,
      dataHash,
    };

    // Use stableStringify for deterministic serialization
    const messageString = stableStringify(signMessage);

    // Step 3: Compute SHA256 hash
    const messageHash = crypto
      .createHash('sha256')
      .update(messageString, 'utf8')
      .digest();

    // Client signature is 65 bytes (r + s + recoveryParam)
    // @noble/secp256k1.verify expects 64 bytes (r + s only)
    // Remove the last byte (recoveryParam) from the hex signature
    const signature64Bytes =
      signature.length === 130 ? signature.slice(0, 128) : signature;

    // Step 4: Verify signature using secp256k1
    // @noble/secp256k1 v1.7.1 expects: verify(signature, messageHash, publicKey)
    // All parameters can be hex strings or Uint8Array
    const isValid = secp256k1.verify(
      signature64Bytes,
      messageHash.toString('hex'),
      publicKey,
      // Use strict: false to allow non-strict DER signatures
      { strict: false },
    );

    return { valid: isValid };
  } catch (error) {
    console.error('[MockServer] Signature verification error:', error);
    return { valid: false, error: String(error) };
  }
};

const sendJson = <T>(
  res: http.ServerResponse,
  statusCode: number,
  payload: IApiClientResponse<T>,
): void => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  });
  res.end(JSON.stringify(payload));
};

export const startKeylessCloudSyncMockServer = (
  options: IKeylessCloudSyncMockServerOptions = {},
): http.Server => {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;

  const server = http.createServer(async (req, res) => {
    try {
      const url = req.url ?? '';

      // Handle CORS preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400', // 24 hours
        });
        res.end();
        return;
      }

      if (req.method === 'GET' && url === '/health') {
        sendJson(res, 200, { code: 0, message: 'ok', data: { ok: true } });
        return;
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, {
          code: 405,
          message: 'Method not allowed',
          data: null as unknown as null,
        });
        return;
      }

      const signatureHeader = getHeaderValue(req, 'x-keyless-sync-signature');

      // No need for separate x-keyless-public-key header
      // publicKey is included in the signature header payload

      if (url === '/prime/v1/sync/upload-keyless') {
        const body = (await readJsonBody(req)) as ICloudSyncUploadPostData;

        // Verify signature for upload (must include dataHash)
        if (!signatureHeader) {
          sendJson(res, 401, {
            code: 401,
            message: 'Missing x-keyless-sync-signature header',
            data: null as unknown as null,
          });
          return;
        }

        const signaturePayload = parseSignatureHeader(signatureHeader);
        if (!signaturePayload) {
          sendJson(res, 401, {
            code: 401,
            message: 'Invalid signature header format',
            data: null as unknown as null,
          });
          return;
        }

        // Compute dataHash from postData using stableStringify
        const postDataString = stableStringify(body);
        const dataHash = computeDataHash(postDataString);

        // Verify signature with dataHash
        const verifyResult = await verifySignature({
          publicKey: signaturePayload.publicKey,
          signature: signaturePayload.signature,
          timestamp: signaturePayload.timestamp,
          nonce: signaturePayload.nonce,
          dataHash,
        });

        if (!verifyResult.valid) {
          sendJson(res, 401, {
            code: 401,
            message: verifyResult.error || 'Invalid signature',
            data: null as unknown as null,
          });
          return;
        }

        // Upload data using publicKey from signature payload
        const result = await store.upload({
          publicKey: signaturePayload.publicKey,
          postData: body,
        });
        sendJson(res, 200, { code: 0, message: 'ok', data: result });
        return;
      }

      if (url === '/prime/v1/sync/check-keyless') {
        const body = (await readJsonBody(
          req,
        )) as ICloudSyncCheckServerStatusPostData;

        // Verify signature for checkStatus
        if (!signatureHeader) {
          sendJson(res, 401, {
            code: 401,
            message: 'Missing x-keyless-sync-signature header',
            data: null as unknown as null,
          });
          return;
        }

        const signaturePayload = parseSignatureHeader(signatureHeader);
        if (!signaturePayload) {
          sendJson(res, 401, {
            code: 401,
            message: 'Invalid signature header format',
            data: null as unknown as null,
          });
          return;
        }

        // Compute dataHash from postData (same as client)
        const postDataString = stableStringify(body);
        const dataHash = computeDataHash(postDataString);

        // Verify signature (with dataHash to match client behavior)
        const verifyResult = await verifySignature({
          publicKey: signaturePayload.publicKey,
          signature: signaturePayload.signature,
          timestamp: signaturePayload.timestamp,
          nonce: signaturePayload.nonce,
          dataHash,
        });

        if (!verifyResult.valid) {
          sendJson(res, 401, {
            code: 401,
            message: verifyResult.error || 'Invalid signature',
            data: null as unknown as null,
          });
          return;
        }

        // Check status using publicKey from signature payload
        const result = await store.checkStatus({
          publicKey: signaturePayload.publicKey,
          postData: body,
        });
        sendJson(res, 200, { code: 0, message: 'ok', data: result });
        return;
      }

      if (url === '/prime/v1/sync/download-keyless') {
        const body = (await readJsonBody(req)) as ICloudSyncDownloadPostData;

        // Verify signature for download
        if (!signatureHeader) {
          sendJson(res, 401, {
            code: 401,
            message: 'Missing x-keyless-sync-signature header',
            data: null as unknown as null,
          });
          return;
        }

        const signaturePayload = parseSignatureHeader(signatureHeader);
        if (!signaturePayload) {
          sendJson(res, 401, {
            code: 401,
            message: 'Invalid signature header format',
            data: null as unknown as null,
          });
          return;
        }

        // Compute dataHash from postData (same as client)
        const postDataString = stableStringify(body);
        const dataHash = computeDataHash(postDataString);

        // Verify signature (with dataHash to match client behavior)
        const verifyResult = await verifySignature({
          publicKey: signaturePayload.publicKey,
          signature: signaturePayload.signature,
          timestamp: signaturePayload.timestamp,
          nonce: signaturePayload.nonce,
          dataHash,
        });

        if (!verifyResult.valid) {
          sendJson(res, 401, {
            code: 401,
            message: verifyResult.error || 'Invalid signature',
            data: null as unknown as null,
          });
          return;
        }

        // Download data using publicKey from signature payload
        const result = await store.download({
          publicKey: signaturePayload.publicKey,
          signatureHeader: signatureHeader ?? '',
          postData: body,
        });
        sendJson(res, 200, { code: 0, message: 'ok', data: result });
        return;
      }

      if (url === '/prime/v1/sync/clear-keyless') {
        // Clear does not require signature verification (as per requirement)
        store.clear();
        sendJson(res, 200, {
          code: 0,
          message: 'ok',
          data: { cleared: true },
        });
        return;
      }

      sendJson(res, 404, {
        code: 404,
        message: 'Not found',
        data: null as unknown as null,
      });
    } catch (error) {
      sendJson(res, 500, {
        code: 500,
        message: error instanceof Error ? error.message : 'Server error',
        data: null as unknown as null,
      });
    }
  });

  server.listen(port, host, () => {
    console.log(
      `[MockServer] Keyless cloud sync mock server listening on http://${host}:${port}`,
    );
  });

  return server;
};
