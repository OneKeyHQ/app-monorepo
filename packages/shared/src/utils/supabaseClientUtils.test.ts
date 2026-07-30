import { OneKeyLocalError } from '../errors';

const mockCreateClient = jest.fn(
  (_url: unknown, _key: unknown, _options: unknown) => ({}),
);

jest.mock('@supabase/supabase-js', () => ({
  createClient: (url: unknown, key: unknown, options: unknown) =>
    mockCreateClient(url, key, options),
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
  contentType = 'application/json',
}: {
  body: string;
  contentType?: string;
}): Response {
  const response = {
    clone: () => ({
      body: undefined,
      text: async () => body,
    }),
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? contentType : null,
    },
    ok: false,
    status: 429,
  };
  return response as unknown as Response;
}

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
    getSupabaseClient();
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
});
