/* eslint-disable onekey/no-raw-error -- tests intentionally simulate raw HTTP / network errors */
import {
  CLI_BOT_WALLET_CLIENT_INTERNALS,
  type ICliBotWalletKeyHttpClient,
  registerKey,
  revokeKey,
} from '../register';

function makeHttp(
  responder: (
    url: string,
    body?: unknown,
    config?: Record<string, unknown>,
  ) => Promise<{ data: unknown }>,
): ICliBotWalletKeyHttpClient & { post: jest.Mock } {
  const post = jest.fn(responder);
  return { post } as unknown as ICliBotWalletKeyHttpClient & {
    post: jest.Mock;
  };
}

describe('registerKey (AC9)', () => {
  it('POST body field set is EXACTLY ["keyBase64"] — no leakage', async () => {
    let capturedBody: unknown;
    let capturedConfig: Record<string, unknown> | undefined;
    const http = makeHttp(async (_url, body, config) => {
      capturedBody = body;
      capturedConfig = config;
      return { data: { keyId: 'K', accessToken: 'A' } };
    });
    await registerKey('AAAA', { baseUrl: 'http://x', http });
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.mock.calls[0][0]).toBe('http://x/v1/bot-wallet-keys');
    // Whitelist assertion: keys must be exactly ['keyBase64'], in any order
    expect(Object.keys(capturedBody as object).toSorted()).toEqual([
      'keyBase64',
    ]);
    expect(capturedBody).toEqual({ keyBase64: 'AAAA' });
    expect(capturedConfig?.timeout).toBe(
      CLI_BOT_WALLET_CLIENT_INTERNALS.REGISTER_TIMEOUT_MS,
    );
    expect(capturedConfig?.signal).toBeInstanceOf(AbortSignal);
  });

  it('parses 200 response { keyId, accessToken }', async () => {
    const http = makeHttp(async () => ({
      data: { keyId: 'k1', accessToken: 't1' },
    }));
    const out = await registerKey('AAAA', { baseUrl: 'http://x', http });
    expect(out).toEqual({ keyId: 'k1', accessToken: 't1' });
  });

  it('throws when service returns malformed body', async () => {
    const http = makeHttp(async () => ({
      data: { keyId: 'k1' /* missing accessToken */ },
    }));
    await expect(
      registerKey('AAAA', { baseUrl: 'http://x', http }),
    ).rejects.toThrow(/malformed response/);
  });

  it('translates ECONNREFUSED into a clear unreachable-service error', async () => {
    const http = makeHttp(async () => {
      // eslint-disable-next-line no-restricted-syntax
      const e = Object.assign(
        new Error('connect ECONNREFUSED 127.0.0.1:8787'),
        { code: 'ECONNREFUSED' },
      );
      throw e;
    });
    await expect(
      registerKey('AAAA', { baseUrl: 'http://x', http }),
    ).rejects.toThrow(
      /Cannot reach Bot Wallet key service at http:\/\/x \(connection refused\)/,
    );
  });

  it('translates request timeouts into a clear unreachable-service error', async () => {
    const http = makeHttp(async () => {
      // eslint-disable-next-line no-restricted-syntax
      const e = Object.assign(new Error('timeout of 3000ms exceeded'), {
        code: 'ECONNABORTED',
      });
      throw e;
    });
    await expect(
      registerKey('AAAA', { baseUrl: 'http://x', http }),
    ).rejects.toThrow(
      /Cannot reach Bot Wallet key service at http:\/\/x \(request timed out\)/,
    );
  });

  it('preserves the original network error as `cause`', async () => {
    // eslint-disable-next-line no-restricted-syntax
    const original = Object.assign(new Error('ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    const http = makeHttp(async () => {
      throw original;
    });
    let captured: unknown;
    try {
      await registerKey('AAAA', { baseUrl: 'http://x', http });
    } catch (e) {
      captured = e;
    }
    expect((captured as { cause?: unknown })?.cause).toBe(original);
  });

  it('uses default base URL 127.0.0.1:8787 when none specified', () => {
    expect(CLI_BOT_WALLET_CLIENT_INTERNALS.DEFAULT_BASE_URL).toBe(
      'http://127.0.0.1:8787',
    );
  });
});

describe('revokeKey (AC9 — best-effort)', () => {
  it('POST happy path includes Bearer header and 3s AbortSignal', async () => {
    let capturedConfig: Record<string, unknown> | undefined;
    const http = makeHttp(async (_url, _body, config) => {
      capturedConfig = config;
      return { data: { revoked: true } };
    });
    await revokeKey('keyA', 'tokenA', { baseUrl: 'http://x', http });
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.mock.calls[0][0]).toBe(
      'http://x/v1/bot-wallet-keys/keyA/revoke',
    );
    expect(
      (capturedConfig?.headers as Record<string, string>)?.Authorization,
    ).toBe('Bearer tokenA');
    // Has timeout config
    expect(capturedConfig?.timeout).toBe(
      CLI_BOT_WALLET_CLIENT_INTERNALS.REVOKE_TIMEOUT_MS,
    );
    expect(capturedConfig?.signal).toBeInstanceOf(AbortSignal);
  });

  it('swallows network errors (logger.warn called, NO throw)', async () => {
    const http = makeHttp(async () => {
      // eslint-disable-next-line no-restricted-syntax
      throw new Error('connect EHOSTUNREACH');
    });
    const warn = jest.fn();
    await expect(
      revokeKey('keyA', 'tokenA', {
        baseUrl: 'http://x',
        http,
        logger: { warn },
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/best-effort revoke failed/);
  });

  it('swallows 401 errors (auth failures do not propagate)', async () => {
    const http = makeHttp(async () => {
      const e = new Error('Request failed with status code 401');
      // axios-style error shape; we only care that it throws
      throw e;
    });
    const warn = jest.fn();
    await revokeKey('keyA', 'tokenA', {
      baseUrl: 'http://x',
      http,
      logger: { warn },
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('AbortSignal.timeout fires after 3s when service hangs (real-timer)', async () => {
    // Use the real AbortSignal.timeout to ensure axios receives a signal that
    // truly aborts after the configured TTL. We assert the config carries a
    // signal that aborts in <= REVOKE_TIMEOUT_MS + buffer.
    let capturedSignal: AbortSignal | undefined;
    const http = makeHttp(async (_url, _body, config) => {
      capturedSignal = config?.signal as AbortSignal;
      // Return a never-resolving-but-cancellable promise
      return new Promise((resolve, reject) => {
        capturedSignal?.addEventListener('abort', () => {
          reject(new Error('AbortError: timeout'));
        });
      });
    });
    const warn = jest.fn();
    const t0 = Date.now();
    await revokeKey('keyA', 'tokenA', {
      baseUrl: 'http://x',
      http,
      logger: { warn },
    });
    const elapsed = Date.now() - t0;
    expect(warn).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeGreaterThanOrEqual(2900);
    expect(elapsed).toBeLessThanOrEqual(3500);
  }, 5000);
});
