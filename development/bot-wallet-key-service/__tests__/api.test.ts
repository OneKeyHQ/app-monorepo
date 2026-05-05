import { readFileSync } from 'node:fs';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  FIXTURE_KEY_BASE64,
  FIXTURE_KEY_BASE64_B,
  type ITestServer,
  httpJson,
  registerKey,
  startTestServer,
} from './test-utils';

describe('Service v1 HTTP API', () => {
  let srv: ITestServer;

  beforeEach(async () => {
    srv = await startTestServer();
  });

  afterEach(async () => {
    await srv.close();
  });

  // --- AC2: POST /v1/bot-wallet-keys (register) ---
  describe('POST /v1/bot-wallet-keys (register, AC2)', () => {
    it('happy path: returns { keyId, accessToken } and persists sha256(token) only', async () => {
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyBase64: FIXTURE_KEY_BASE64 }),
      });
      expect(res.status).toBe(200);
      const body = res.json<{ keyId: string; accessToken: string }>();
      const bodyKeys: string[] = Object.keys(body);
      expect(bodyKeys.length).toBe(2);
      expect(bodyKeys).toContain('accessToken');
      expect(bodyKeys).toContain('keyId');
      expect(body.keyId).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32B base64url unpadded
      expect(body.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const stored = srv.store.get(body.keyId);
      expect(stored).toBeDefined();
      // Plaintext token MUST NOT appear in the stored record.
      expect(JSON.stringify(stored)).not.toContain(body.accessToken);
      // The stored sha256 MUST be the sha256 of the plaintext token.
      const { createHash } = await import('node:crypto');
      const expectedHash = createHash('sha256')
        .update(body.accessToken)
        .digest('hex');
      expect(stored?.accessTokenSha256).toBe(expectedHash);
    });

    it('rejects body missing keyBase64 → 400 INVALID_BODY (no fs change)', async () => {
      const before = readFileSafe(srv.filePath);
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(400);
      expect(res.json()).toEqual({ error: 'INVALID_BODY' });
      expect(readFileSafe(srv.filePath)).toBe(before);
    });

    it('rejects body with extra fields → 400 INVALID_BODY (no fs change)', async () => {
      const before = readFileSafe(srv.filePath);
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyBase64: FIXTURE_KEY_BASE64,
          ciphertextBase64: 'leak',
        }),
      });
      expect(res.status).toBe(400);
      expect(res.json()).toEqual({ error: 'INVALID_BODY' });
      expect(readFileSafe(srv.filePath)).toBe(before);
    });

    it('rejects keyBase64 that is not valid base64 → 400', async () => {
      for (const bad of ['not base64!', '###', 'AAAA===', '']) {
        const res = await httpJson(`${srv.url}/v1/bot-wallet-keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyBase64: bad }),
        });
        expect(res.status).toBe(400);
        expect(res.json()).toEqual({ error: 'INVALID_BODY' });
      }
    });

    it('rejects valid base64 that is not a 32-byte AES key → 400', async () => {
      for (const bad of ['AQ==', Buffer.alloc(31, 1).toString('base64')]) {
        const res = await httpJson(`${srv.url}/v1/bot-wallet-keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyBase64: bad }),
        });
        expect(res.status).toBe(400);
        expect(res.json()).toEqual({ error: 'INVALID_BODY' });
      }
    });

    it('persisted file contains ONLY whitelisted fields (grep contract)', async () => {
      const a = await registerKey(srv.url, FIXTURE_KEY_BASE64);
      const raw = readFileSync(srv.filePath, 'utf8');
      // Whitelist appears
      expect(raw).toContain('keyBase64');
      expect(raw).toContain('accessTokenSha256');
      expect(raw).toContain('createdAt');
      // Forbidden never appears
      for (const forbidden of [
        'ciphertextBase64',
        'mnemonic',
        'seedPhrase',
        'walletId',
        'displayAddress',
        'sourceLabel',
      ]) {
        expect(raw).not.toContain(forbidden);
      }
      // Plaintext token MUST NOT appear
      expect(raw).not.toContain(a.accessToken);
    });

    it('two registrations with same keyBase64 produce distinct keyIds', async () => {
      const a = await registerKey(srv.url, FIXTURE_KEY_BASE64);
      const b = await registerKey(srv.url, FIXTURE_KEY_BASE64);
      expect(a.keyId).not.toBe(b.keyId);
      expect(a.accessToken).not.toBe(b.accessToken);
    });

    it('rejects malformed JSON body → 400', async () => {
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      });
      expect(res.status).toBe(400);
      expect(res.json()).toEqual({ error: 'INVALID_BODY' });
    });
  });

  // --- AC3: GET /v1/bot-wallet-keys/:keyId (fetch) ---
  describe('GET /v1/bot-wallet-keys/:keyId (fetch, AC3)', () => {
    it('happy path: returns { keyBase64 } with valid Bearer token', async () => {
      const { keyId, accessToken } = await registerKey(
        srv.url,
        FIXTURE_KEY_BASE64,
      );
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys/${keyId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      expect(res.json()).toEqual({ keyBase64: FIXTURE_KEY_BASE64 });
    });

    it('missing Authorization header → 401', async () => {
      const { keyId } = await registerKey(srv.url, FIXTURE_KEY_BASE64);
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys/${keyId}`, {
        method: 'GET',
      });
      expect(res.status).toBe(401);
      expect(res.json()).toEqual({ error: 'UNAUTHORIZED' });
      expect(res.body).not.toContain(FIXTURE_KEY_BASE64);
    });

    it('wrong Bearer prefix → 401', async () => {
      const { keyId, accessToken } = await registerKey(
        srv.url,
        FIXTURE_KEY_BASE64,
      );
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys/${keyId}`, {
        method: 'GET',
        headers: { Authorization: `Basic ${accessToken}` },
      });
      expect(res.status).toBe(401);
      expect(res.json()).toEqual({ error: 'UNAUTHORIZED' });
    });

    it('non-base64 access token → 401 (uniform error shape)', async () => {
      const { keyId } = await registerKey(srv.url, FIXTURE_KEY_BASE64);
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys/${keyId}`, {
        method: 'GET',
        headers: { Authorization: 'Bearer not!!base64' },
      });
      expect(res.status).toBe(401);
      expect(res.json()).toEqual({ error: 'UNAUTHORIZED' });
    });

    it('wrong access token → 401 (no key disclosure)', async () => {
      const { keyId } = await registerKey(srv.url, FIXTURE_KEY_BASE64);
      const wrongToken = 'A'.repeat(43);
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys/${keyId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${wrongToken}` },
      });
      expect(res.status).toBe(401);
      expect(res.body).not.toContain(FIXTURE_KEY_BASE64);
    });

    it('unknown keyId → 404', async () => {
      const res = await httpJson(
        `${srv.url}/v1/bot-wallet-keys/unknown-key-id-9999999999`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${'A'.repeat(43)}` },
        },
      );
      expect(res.status).toBe(404);
      expect(res.json()).toEqual({ error: 'NOT_FOUND' });
    });

    it('uses crypto.timingSafeEqual under the hood (spy assertion)', async () => {
      const { cryptoBridge } = await import('../src/crypto-bridge');
      const spy = jest.spyOn(cryptoBridge, 'timingSafeEqual');
      const { keyId, accessToken } = await registerKey(
        srv.url,
        FIXTURE_KEY_BASE64,
      );
      await httpJson(`${srv.url}/v1/bot-wallet-keys/${keyId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('uses fixed-length timingSafeEqual for wrong tokens', async () => {
      const { cryptoBridge } = await import('../src/crypto-bridge');
      const spy = jest.spyOn(cryptoBridge, 'timingSafeEqual');
      const { keyId } = await registerKey(srv.url, FIXTURE_KEY_BASE64);
      const wrongToken = 'B'.repeat(43);

      try {
        const res = await httpJson(`${srv.url}/v1/bot-wallet-keys/${keyId}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${wrongToken}` },
        });

        expect(res.status).toBe(401);
        expect(res.json()).toEqual({ error: 'UNAUTHORIZED' });
        expect(res.body).not.toContain(FIXTURE_KEY_BASE64);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].byteLength).toBe(32);
        expect(spy.mock.calls[0][1].byteLength).toBe(32);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // --- AC4: POST /v1/bot-wallet-keys/:keyId/revoke ---
  describe('POST /v1/bot-wallet-keys/:keyId/revoke (revoke, AC4)', () => {
    it('happy path returns { revoked: true } and persists revokedAt', async () => {
      const { keyId, accessToken } = await registerKey(
        srv.url,
        FIXTURE_KEY_BASE64,
      );
      srv.setNow(() => 1_700_000_000_000);
      const res = await httpJson(
        `${srv.url}/v1/bot-wallet-keys/${keyId}/revoke`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      expect(res.status).toBe(200);
      expect(res.json()).toEqual({ revoked: true });
      expect(srv.store.get(keyId)?.revokedAt).toBe(1_700_000_000_000);
      expect(srv.store.get(keyId)?.keyBase64).toBe('');
    });

    it('revoke is idempotent (second call still 200)', async () => {
      const { keyId, accessToken } = await registerKey(
        srv.url,
        FIXTURE_KEY_BASE64,
      );
      const res1 = await httpJson(
        `${srv.url}/v1/bot-wallet-keys/${keyId}/revoke`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const res2 = await httpJson(
        `${srv.url}/v1/bot-wallet-keys/${keyId}/revoke`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res2.json()).toEqual({ revoked: true });
    });

    it('GET after revoke → 403 REVOKED, no key disclosure', async () => {
      const { keyId, accessToken } = await registerKey(
        srv.url,
        FIXTURE_KEY_BASE64,
      );
      await httpJson(`${srv.url}/v1/bot-wallet-keys/${keyId}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys/${keyId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(403);
      expect(res.json()).toEqual({ error: 'REVOKED' });
      expect(res.body).not.toContain(FIXTURE_KEY_BASE64);
    });

    it('revoke without auth → 401', async () => {
      const { keyId } = await registerKey(srv.url, FIXTURE_KEY_BASE64);
      const res = await httpJson(
        `${srv.url}/v1/bot-wallet-keys/${keyId}/revoke`,
        { method: 'POST' },
      );
      expect(res.status).toBe(401);
      expect(res.json()).toEqual({ error: 'UNAUTHORIZED' });
    });

    it('revoke with wrong token → 401', async () => {
      const { keyId } = await registerKey(srv.url, FIXTURE_KEY_BASE64);
      const res = await httpJson(
        `${srv.url}/v1/bot-wallet-keys/${keyId}/revoke`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${'X'.repeat(43)}` },
        },
      );
      expect(res.status).toBe(401);
    });

    it('revoke unknown keyId → 404', async () => {
      const res = await httpJson(
        `${srv.url}/v1/bot-wallet-keys/unknown-id-7777777777/revoke`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${'A'.repeat(43)}` },
        },
      );
      expect(res.status).toBe(404);
      expect(res.json()).toEqual({ error: 'NOT_FOUND' });
    });
  });

  // --- AC6: scope guard / unknown endpoints ---
  describe('Scope guard (AC6)', () => {
    it.each([
      ['GET', '/health'],
      ['GET', '/v1/bot-wallet-keys'],
      ['POST', '/v1/anything'],
      ['DELETE', '/v1/bot-wallet-keys/123'],
      ['PUT', '/v1/bot-wallet-keys/123'],
    ])('%s %s → 404 NOT_FOUND', async (method, path) => {
      const res = await httpJson(`${srv.url}${path}`, {
        method: method as 'GET' | 'POST' | 'DELETE' | 'PUT',
      });
      expect(res.status).toBe(404);
      expect(res.json()).toEqual({ error: 'NOT_FOUND' });
    });
  });

  describe('CORS', () => {
    it('OPTIONS preflight returns 204 with reflected origin and requested headers', async () => {
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type, authorization',
        },
      });
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
      expect(res.headers.vary).toBe('Origin');
      expect(String(res.headers['access-control-allow-methods'])).toContain(
        'POST',
      );
      expect(String(res.headers['access-control-allow-headers'])).toContain(
        'content-type',
      );
    });

    it('actual response includes CORS headers reflecting the Origin', async () => {
      const res = await httpJson(`${srv.url}/v1/bot-wallet-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://127.0.0.1:5173',
        },
        body: JSON.stringify({ keyBase64: FIXTURE_KEY_BASE64 }),
      });
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://127.0.0.1:5173',
      );
      expect(res.headers.vary).toBe('Origin');
    });
  });

  it('isolation between keyIds: token A cannot fetch key B', async () => {
    const a = await registerKey(srv.url, FIXTURE_KEY_BASE64);
    const b = await registerKey(srv.url, FIXTURE_KEY_BASE64_B);
    const res = await httpJson(`${srv.url}/v1/bot-wallet-keys/${b.keyId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${a.accessToken}` },
    });
    expect(res.status).toBe(401);
  });
});

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}
