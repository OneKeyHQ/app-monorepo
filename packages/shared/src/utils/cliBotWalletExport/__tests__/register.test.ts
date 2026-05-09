/* eslint-disable onekey/no-raw-error -- tests intentionally simulate raw HTTP / network errors */
import {
  BOT_WALLET_HASH_INTERNALS,
  buildBotWalletHash,
  isBotWalletHash,
} from '../botWalletHash';
import {
  CLI_BOT_WALLET_CLIENT_INTERNALS,
  type ICliBotWalletKeyHttpClient,
  registerKey,
  revokeKey,
} from '../register';

const VALID_BOT_WALLET_HASH = 'a'.repeat(64);

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

describe('buildBotWalletHash', () => {
  it('builds a deterministic salted sha256 hash for the same walletId', () => {
    const hash1 = buildBotWalletHash('wallet-1');
    const hash2 = buildBotWalletHash('wallet-1');
    const hash3 = buildBotWalletHash('wallet-2');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).not.toContain('wallet-1');
    expect(BOT_WALLET_HASH_INTERNALS.BOT_WALLET_HASH_ALGORITHM).toBe('sha256');
    expect(BOT_WALLET_HASH_INTERNALS.BOT_WALLET_HASH_SALT).toContain(':v1');
  });

  it('validates hash shape', () => {
    expect(isBotWalletHash(buildBotWalletHash('wallet-1'))).toBe(true);
    expect(isBotWalletHash('wallet-1')).toBe(false);
    expect(isBotWalletHash('A'.repeat(64))).toBe(false);
  });
});

describe('registerKey (AC9)', () => {
  it('POST body field set is EXACTLY ["botWalletHash", "keyBase64"] and uses the Prime API path', async () => {
    let capturedBody: unknown;
    const http = makeHttp(async (_url, body) => {
      capturedBody = body;
      return {
        data: {
          code: 0,
          message: 'success',
          data: { keyId: 'K', accessToken: 'A' },
        },
      };
    });
    await registerKey(
      { botWalletHash: VALID_BOT_WALLET_HASH, keyBase64: 'AAAA' },
      { baseUrl: 'http://x', http },
    );
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.mock.calls[0][0]).toBe(
      CLI_BOT_WALLET_CLIENT_INTERNALS.BOT_WALLET_KEY_API_PATH,
    );
    // Whitelist assertion: keys must be exactly these two fields, in any order.
    expect(Object.keys(capturedBody as object).toSorted()).toEqual([
      'botWalletHash',
      'keyBase64',
    ]);
    expect(capturedBody).toEqual({
      botWalletHash: VALID_BOT_WALLET_HASH,
      keyBase64: 'AAAA',
    });
  });

  it('parses 200 response { keyId, accessToken }', async () => {
    const http = makeHttp(async () => ({
      data: {
        code: 0,
        message: 'success',
        data: { keyId: 'k1', accessToken: 't1' },
      },
    }));
    const out = await registerKey(
      { botWalletHash: VALID_BOT_WALLET_HASH, keyBase64: 'AAAA' },
      { baseUrl: 'http://x', http },
    );
    expect(out).toEqual({ keyId: 'k1', accessToken: 't1' });
  });

  it('rejects malformed botWalletHash before making a request', async () => {
    const http = makeHttp(async () => ({
      data: {
        code: 0,
        message: 'success',
        data: { keyId: 'k1', accessToken: 't1' },
      },
    }));
    await expect(
      registerKey(
        { botWalletHash: 'wallet-1', keyBase64: 'AAAA' },
        { baseUrl: 'http://x', http },
      ),
    ).rejects.toThrow(/requires botWalletHash/);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('throws when the API envelope returns a non-zero code', async () => {
    const http = makeHttp(async () => ({
      data: {
        code: 40_001,
        message: 'invalid key',
        data: null,
      },
    }));
    await expect(
      registerKey(
        { botWalletHash: VALID_BOT_WALLET_HASH, keyBase64: 'AAAA' },
        { baseUrl: 'http://x', http },
      ),
    ).rejects.toThrow(/Bot Wallet key API error \(code 40001\): invalid key/);
  });

  it('throws when API returns malformed data', async () => {
    const http = makeHttp(async () => ({
      data: {
        code: 0,
        message: 'success',
        data: { keyId: 'k1' /* missing accessToken */ },
      },
    }));
    await expect(
      registerKey(
        { botWalletHash: VALID_BOT_WALLET_HASH, keyBase64: 'AAAA' },
        { baseUrl: 'http://x', http },
      ),
    ).rejects.toThrow(/malformed response/);
  });

  it('translates ECONNREFUSED into a clear unreachable-service error', async () => {
    const http = makeHttp(async () => {
      // eslint-disable-next-line no-restricted-syntax
      const e = Object.assign(
        new Error('connect ECONNREFUSED prime.onekeytest.com:443'),
        { code: 'ECONNREFUSED' },
      );
      throw e;
    });
    await expect(
      registerKey(
        { botWalletHash: VALID_BOT_WALLET_HASH, keyBase64: 'AAAA' },
        { baseUrl: 'http://x', http },
      ),
    ).rejects.toThrow(
      /Cannot reach Bot Wallet key API at http:\/\/x \(connection refused\)/,
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
      registerKey(
        { botWalletHash: VALID_BOT_WALLET_HASH, keyBase64: 'AAAA' },
        { baseUrl: 'http://x', http },
      ),
    ).rejects.toThrow(
      /Cannot reach Bot Wallet key API at http:\/\/x \(request timed out\)/,
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
      await registerKey(
        { botWalletHash: VALID_BOT_WALLET_HASH, keyBase64: 'AAAA' },
        { baseUrl: 'http://x', http },
      );
    } catch (e) {
      captured = e;
    }
    expect((captured as { cause?: unknown })?.cause).toBe(original);
  });

  it('uses the Prime API path for default endpoint resolution', () => {
    expect(CLI_BOT_WALLET_CLIENT_INTERNALS.BOT_WALLET_KEY_API_PATH).toBe(
      '/prime/v1/bot-wallet-keys',
    );
  });
});

describe('revokeKey (AC9 — best-effort)', () => {
  it('POST happy path includes Prime token header', async () => {
    let capturedConfig: Record<string, unknown> | undefined;
    const http = makeHttp(async (_url, _body, config) => {
      capturedConfig = config;
      return { data: { revoked: true } };
    });
    await revokeKey('keyA', 'tokenA', { baseUrl: 'http://x', http });
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.mock.calls[0][0]).toBe(
      '/prime/v1/bot-wallet-keys/keyA/revoke',
    );
    expect(
      (capturedConfig?.headers as Record<string, string>)?.[
        CLI_BOT_WALLET_CLIENT_INTERNALS.BOT_WALLET_KEY_API_TOKEN_HEADER
      ],
    ).toBe('tokenA');
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
});
