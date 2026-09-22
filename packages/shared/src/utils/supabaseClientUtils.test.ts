import { OneKeyLocalError } from '../errors';

const mockCreateClient = jest.fn(
  (_url: unknown, _key: unknown, _options: unknown) => ({}),
);

jest.mock('@supabase/supabase-js', () => ({
  createClient: (url: unknown, key: unknown, options: unknown) =>
    mockCreateClient(url, key, options),
}));

jest.mock('../request/requestHelper', () => ({
  __esModule: true,
  default: {
    getDevSettingsPersistAtom: jest.fn(async () => ({ enabled: false })),
  },
}));

jest.mock(
  '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance',
  () => ({
    __esModule: true,
    default: {},
  }),
);

function createErrorResponse({
  body,
  cloneError,
  contentType = 'application/json',
  status = 429,
}: {
  body: string;
  cloneError?: Error;
  contentType?: string;
  status?: number;
}): Response {
  const response = {
    clone: () => {
      if (cloneError) {
        throw cloneError;
      }
      return {
        body: undefined,
        text: async () => body,
      };
    },
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? contentType : null,
    },
    ok: false,
    status,
  };
  return response as unknown as Response;
}

describe('email Supabase environment isolation', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreateClient.mockClear();
  });

  test('selects matching URL, public key and session slot and reuses only the same project client', async () => {
    const { default: requestHelper } = await import('../request/requestHelper');
    const { ONEKEY_ID_AUTH_CONFIG } = await import('../consts/authConsts');
    const { getSupabaseClient, isSupabaseTokenRefreshRuntime } =
      await import('./supabaseClientUtils');
    const settings = jest.mocked(requestHelper.getDevSettingsPersistAtom);
    settings.mockResolvedValue({ enabled: false });
    const prod = await getSupabaseClient();
    settings.mockResolvedValue({
      enabled: true,
      settings: { enableTestEndpoint: true },
    });
    const test = await getSupabaseClient();
    expect(test.client).not.toBe(prod.client);
    expect(test.sessionKey).not.toBe(prod.sessionKey);
    for (const [index, environment] of (['prod', 'test'] as const).entries()) {
      const config = ONEKEY_ID_AUTH_CONFIG[environment];
      expect(mockCreateClient).toHaveBeenNthCalledWith(
        index + 1,
        config.projectUrl,
        config.publicKey,
        expect.objectContaining({
          auth: expect.objectContaining({
            storageKey: `sb-${new URL(config.projectUrl).hostname.split('.')[0]}-auth-token`,
            flowType: 'pkce',
            persistSession: isSupabaseTokenRefreshRuntime(),
            autoRefreshToken: isSupabaseTokenRefreshRuntime(),
          }),
        }),
      );
    }
    settings.mockResolvedValue({
      enabled: true,
      settings: { enableTestEndpoint: false },
    });
    expect((await getSupabaseClient()).client).toBe(prod.client);
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });

  test('does not create a client if persisted settings are unavailable', async () => {
    const { default: requestHelper } = await import('../request/requestHelper');
    jest
      .mocked(requestHelper.getDevSettingsPersistAtom)
      .mockRejectedValueOnce(new Error('settings unavailable'));
    const { getSupabaseClient } = await import('./supabaseClientUtils');
    await expect(getSupabaseClient()).rejects.toThrow('settings unavailable');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});

describe('sessionPreservingSupabaseFetch', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    mockCreateClient.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  async function getGuardedFetch(): Promise<typeof fetch> {
    const { getSupabaseClient } = await import('./supabaseClientUtils');
    await getSupabaseClient();
    const options = mockCreateClient.mock.calls[0]?.[2] as
      | {
          global?: {
            fetch?: typeof fetch;
          };
        }
      | undefined;
    if (!options?.global?.fetch) {
      throw new OneKeyLocalError('Supabase guarded fetch was not configured');
    }
    return options.global.fetch;
  }

  test('passes through the definitive email OTP cooldown response', async () => {
    const response = createErrorResponse({
      body: JSON.stringify({
        code: 'over_email_send_rate_limit',
        message:
          'For security purposes, you can only request this after 33 seconds.',
      }),
    });
    globalThis.fetch = jest.fn(async () => response);
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch('https://example.supabase.co/auth/v1/otp'),
    ).resolves.toBe(response);
  });

  test('passes through the definitive email OTP cooldown when content-type is not exposed', async () => {
    const response = createErrorResponse({
      body: JSON.stringify({
        code: 'over_email_send_rate_limit',
        message:
          'For security purposes, you can only request this after 17 seconds.',
      }),
      contentType: '',
    });
    globalThis.fetch = jest.fn(async () => response);
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch('https://example.supabase.co/auth/v1/otp'),
    ).resolves.toBe(response);
  });

  test('passes the email OTP 429 to auth-js when the response clone cannot be read', async () => {
    const response = createErrorResponse({
      body: JSON.stringify({
        code: 'over_email_send_rate_limit',
        message:
          'For security purposes, you can only request this after 17 seconds.',
      }),
      cloneError: new Error('Response body is unavailable to the fetch guard'),
    });
    globalThis.fetch = jest.fn(async () => response);
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch('https://example.supabase.co/auth/v1/otp'),
    ).resolves.toBe(response);
  });

  test('keeps refresh-token HTTP 429 session-preserving', async () => {
    const response = createErrorResponse({
      body: JSON.stringify({
        code: 'over_email_send_rate_limit',
        message:
          'For security purposes, you can only request this after 33 seconds.',
      }),
    });
    globalThis.fetch = jest.fn(async () => response);
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch(
        'https://example.supabase.co/auth/v1/token?grant_type=refresh_token',
      ),
    ).rejects.toThrow('Supabase transient HTTP 429');
  });

  test('keeps non-JSON email OTP HTTP 429 session-preserving', async () => {
    const response = createErrorResponse({
      body: '<html>rate limited</html>',
      contentType: 'text/html',
    });
    globalThis.fetch = jest.fn(async () => response);
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch('https://example.supabase.co/auth/v1/otp'),
    ).rejects.toThrow('Supabase transient HTTP 429');
  });

  test('keeps other JSON email OTP HTTP 429 session-preserving', async () => {
    const response = createErrorResponse({
      body: JSON.stringify({
        code: 'over_request_rate_limit',
        message: 'Too many requests.',
      }),
    });
    globalThis.fetch = jest.fn(async () => response);
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch('https://example.supabase.co/auth/v1/otp'),
    ).rejects.toThrow('Supabase transient HTTP 429');
  });

  test('keeps an ambiguous refresh-token HTTP 400 session-preserving', async () => {
    const response = createErrorResponse({
      body: JSON.stringify({
        code: 'unexpected_refresh_failure',
        message: 'Please try again later.',
      }),
      status: 400,
    });
    globalThis.fetch = jest.fn(async () => response);
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch(
        'https://example.supabase.co/auth/v1/token?grant_type=refresh_token',
      ),
    ).rejects.toThrow('Supabase ambiguous refresh-token HTTP 400');
  });

  test.each([
    'invalid_grant',
    'refresh_token_not_found',
    'refresh_token_already_used',
  ])('passes through definitive refresh-token rejection %s', async (code) => {
    const response = createErrorResponse({
      body: JSON.stringify({
        code,
        message: 'Refresh token rejected.',
      }),
      status: 400,
    });
    globalThis.fetch = jest.fn(async () => response);
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch(
        'https://example.supabase.co/auth/v1/token?grant_type=refresh_token',
      ),
    ).resolves.toBe(response);
  });

  test('passes through unrelated JSON HTTP 400 responses', async () => {
    const response = createErrorResponse({
      body: JSON.stringify({
        code: 'validation_failed',
        message: 'Invalid request.',
      }),
      status: 400,
    });
    globalThis.fetch = jest.fn(async () => response);
    const guardedFetch = await getGuardedFetch();

    await expect(
      guardedFetch('https://example.supabase.co/auth/v1/otp'),
    ).resolves.toBe(response);
  });
});
