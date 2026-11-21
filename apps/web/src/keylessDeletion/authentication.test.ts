/** @jest-environment node */
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import { exchangeOAuthAccessToken } from './authentication';
import { OAuthCancelledError } from './oauthCancelledError';
import { KEYLESS_OAUTH_MARKER } from './paths';

import type { IProvider } from './protocol';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const project = {
  origin: 'https://oauth-preview.example.invalid',
  publicKey: 'fixture-public-key',
};

function begin(provider: IProvider, controller = new AbortController()) {
  const popup = {
    closed: false,
    location: { href: 'about:blank' },
    close: jest.fn(() => {
      popup.closed = true;
    }),
  };
  let callback: URL | undefined;
  const exchangeCodeForSession = jest.fn().mockResolvedValue({
    data: { session: { access_token: 'fixture-proof' } },
  });
  jest.mocked(createClient).mockImplementation(
    () =>
      ({
        auth: {
          getSession: jest.fn().mockResolvedValue(undefined),
          stopAutoRefresh: jest.fn().mockResolvedValue(undefined),
          signInWithOAuth: jest.fn(
            async ({ options }: { options: { redirectTo: string } }) => {
              callback = new URL(options.redirectTo);
              return { data: { url: `${project.origin}/auth/v1/authorize` } };
            },
          ),
          exchangeCodeForSession,
        },
      }) as unknown as ReturnType<typeof createClient>,
  );
  const request = exchangeOAuthAccessToken(
    project,
    provider,
    popup as unknown as Window,
    controller.signal,
    KEYLESS_OAUTH_MARKER,
  );
  return {
    request,
    popup,
    exchangeCodeForSession,
    redirect(update: (params: URLSearchParams) => void) {
      expect(callback).toBeDefined();
      if (!callback) return;
      const next = new URL(callback);
      update(next.searchParams);
      popup.location.href = next.href;
    },
  };
}

const locationDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'location',
);
const uuidDescriptor = Object.getOwnPropertyDescriptor(
  globalThis.crypto,
  'randomUUID',
);
beforeAll(() => {
  Object.defineProperty(globalThis, 'location', {
    value: new URL('https://app.example.invalid'),
    configurable: true,
  });
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: randomUUID,
    configurable: true,
  });
});
afterAll(() => {
  if (locationDescriptor) {
    Object.defineProperty(globalThis, 'location', locationDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'location');
  }
  if (uuidDescriptor) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', uuidDescriptor);
  } else {
    Reflect.deleteProperty(globalThis.crypto, 'randomUUID');
  }
});
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.useRealTimers();
  jest.resetAllMocks();
});

it.each(['google', 'apple'] as const)(
  'treats closing an already open %s popup as cancellation and ignores its later redirect',
  async (provider) => {
    const attempt = begin(provider);
    const outcome = attempt.request.catch((cause: unknown) => cause);
    await jest.advanceTimersByTimeAsync(0);
    attempt.popup.closed = true;
    await jest.advanceTimersByTimeAsync(200);
    expect(await outcome).toBeInstanceOf(OAuthCancelledError);
    attempt.redirect((params) => params.set('code', 'fixture-late-code'));
    await jest.advanceTimersByTimeAsync(200);
    expect(attempt.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  },
);

it('accepts only the explicit Apple cancellation on its matched redirect', async () => {
  const attempt = begin('apple');
  const outcome = attempt.request.catch((cause: unknown) => cause);
  await jest.advanceTimersByTimeAsync(0);
  attempt.redirect((params) => params.set('error', 'user_cancelled_authorize'));
  await jest.advanceTimersByTimeAsync(200);
  expect(await outcome).toBeInstanceOf(OAuthCancelledError);
  expect(attempt.exchangeCodeForSession).not.toHaveBeenCalled();
  expect(attempt.popup.close).toHaveBeenCalledTimes(1);
});

it.each([
  [
    'wrong state',
    { onekey_oauth_state: 'wrong', error: 'user_cancelled_authorize' },
  ],
  [
    'wrong marker',
    { [KEYLESS_OAUTH_MARKER]: '0', error: 'user_cancelled_authorize' },
  ],
  ['generic denial', { error: 'access_denied' }],
  [
    'specific upstream denial',
    { error: 'access_denied', error_code: 'user_banned' },
  ],
  [
    'conflicting code and cancellation',
    { error: 'user_cancelled_authorize', code: 'fixture-ambiguous-code' },
  ],
])('keeps %s visible as an OAuth error', async (description, response) => {
  const attempt = begin('apple');
  const outcome = attempt.request.catch((cause: unknown) => cause);
  await jest.advanceTimersByTimeAsync(0);
  attempt.redirect((params) => {
    for (const [key, value] of Object.entries(response)) {
      if (value !== undefined) params.set(key, value);
    }
  });
  await jest.advanceTimersByTimeAsync(200);
  expect(await outcome).toMatchObject({ name: 'OperationError' });
  expect(attempt.exchangeCodeForSession).not.toHaveBeenCalled();
});

it('still exchanges a valid callback and closes its own popup', async () => {
  const attempt = begin('google');
  await jest.advanceTimersByTimeAsync(0);
  attempt.redirect((params) => params.set('code', 'fixture-code'));
  await jest.advanceTimersByTimeAsync(200);
  await expect(attempt.request).resolves.toBe('fixture-proof');
  expect(attempt.exchangeCodeForSession).toHaveBeenCalledWith('fixture-code');
  expect(attempt.popup.close).toHaveBeenCalledTimes(1);
});

it('keeps a timeout as a real failure and closes the popup', async () => {
  const attempt = begin('google');
  const outcome = attempt.request.catch((cause: unknown) => cause);
  await jest.advanceTimersByTimeAsync(180_000);
  expect(await outcome).toMatchObject({ name: 'TimeoutError' });
  expect(attempt.popup.close).toHaveBeenCalledTimes(1);
});

it('keeps the outer abort reason even if teardown also closes the popup', async () => {
  const controller = new AbortController();
  const attempt = begin('apple', controller);
  const reason = new DOMException('test signal', 'AbortError');
  const outcome = attempt.request.catch((cause: unknown) => cause);
  await jest.advanceTimersByTimeAsync(0);
  attempt.popup.closed = true;
  controller.abort(reason);
  await jest.advanceTimersByTimeAsync(200);
  expect(await outcome).toBe(reason);
  expect(attempt.exchangeCodeForSession).not.toHaveBeenCalled();
});
