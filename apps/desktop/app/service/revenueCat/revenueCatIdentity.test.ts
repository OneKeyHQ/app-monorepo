import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import {
  SUPABASE_STORAGE_KEY_PREFIX,
  getKeylessSupabaseAuthSessionKey,
  getSupabaseAuthSessionKey,
} from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';
import type { IRevenueCatAuthContext } from '@onekeyhq/shared/types/prime/revenueCat';

import {
  confirmRevenueCatIdentity,
  verifyRevenueCatIdentity,
} from './revenueCatIdentity';

const mockGetSecureItem = jest.fn<string | undefined, [string]>();
const mockFetch = jest.fn<
  Promise<{ ok: boolean; json: () => Promise<unknown> }>,
  [string, RequestInit]
>();
const mockShowMessageBox = jest.fn(
  async (_window: unknown, _options: unknown) => ({ response: 1 }),
);
const mockWindow = { isDestroyed: () => false };

jest.mock('electron', () => ({
  app: { getVersion: () => '6.7.0' },
  net: {
    fetch: (url: string, options: RequestInit) => mockFetch(url, options),
  },
  dialog: {
    showMessageBox: (window: unknown, options: unknown) =>
      mockShowMessageBox(window, options),
  },
}));
jest.mock('../../libs/store', () => ({
  getSecureItem: (key: string) => mockGetSecureItem(key),
}));
jest.mock('../../i18n', () => ({ i18nText: (key: string) => key }));

const context: IRevenueCatAuthContext = {
  sessionSource: EPrimeAuthSessionSource.KeylessOAuth,
  endpointEnv: 'prod',
  instanceId: 'instance-a',
};
const session = JSON.stringify({
  access_token: 'test-token',
  user: { id: 'untrusted-local-id', email: 'untrusted@example.com' },
});
let profile: Record<string, unknown>;
let info: Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  profile = {
    onekeyAccount: {
      onekeyUserId: 'user-a',
      status: 'active',
      normalizedEmail: 'verified@example.com',
    },
  };
  info = { userId: 'user-a', isPrime: false };
  mockGetSecureItem.mockReturnValue(session);
  mockFetch.mockImplementation(async (url) => ({
    ok: true,
    json: async () => ({
      code: 0,
      data: url.endsWith('/profile') ? profile : info,
    }),
  }));
  mockShowMessageBox.mockResolvedValue({ response: 1 });
  Object.defineProperty(globalThis, '$desktopMainAppFunctions', {
    configurable: true,
    value: { getSafelyMainWindow: () => mockWindow },
  });
});

describe('main-process OneKey purchase identity', () => {
  it.each([
    [EPrimeAuthSessionSource.KeylessOAuth, getKeylessSupabaseAuthSessionKey()],
    [EPrimeAuthSessionSource.LegacyEmailSupabase, getSupabaseAuthSessionKey()],
  ] as const)(
    'verifies the %s session with the server, not the stored user label',
    async (sessionSource, key) => {
      const identity = await verifyRevenueCatIdentity({
        ...context,
        sessionSource,
      });
      expect(identity).toMatchObject({
        userId: 'user-a',
        email: 'verified@example.com',
        isPrime: false,
      });
      expect(mockGetSecureItem).toHaveBeenCalledWith(
        `${SUPABASE_STORAGE_KEY_PREFIX}${key}`,
      );
      expect(mockFetch.mock.calls.map(([url]) => url)).toEqual([
        'https://prime.onekeycn.com/prime/v1/account/profile',
        'https://prime.onekeycn.com/prime/v1/user/info',
      ]);
      expect(mockFetch.mock.calls[0][1]).toMatchObject({
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          'X-Onekey-Request-Token': 'test-token',
          'X-Onekey-Instance-Id': 'instance-a',
        },
      });
    },
  );

  it('uses only the fixed test endpoint when the test realm is selected', async () => {
    await verifyRevenueCatIdentity({ ...context, endpointEnv: 'test' });
    expect(
      mockFetch.mock.calls.every(([url]) =>
        url.startsWith('https://prime.onekeytest.com/'),
      ),
    ).toBe(true);
  });

  it.each([undefined, '', 'not-json', '{}', '{"access_token":42}'])(
    'rejects unusable secure storage (%s) before networking',
    async (raw) => {
      mockGetSecureItem.mockReturnValue(raw);
      await expect(verifyRevenueCatIdentity(context)).rejects.toThrow(
        ETranslations.prime_onekey_id_session_changed__msg,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    { endpointEnv: 'https://attacker.example' },
    { sessionSource: '../../arbitrary-key' },
    { instanceId: 'id\r\nInjected: value' },
  ])('rejects untrusted context selectors %j', async (invalid) => {
    await expect(
      verifyRevenueCatIdentity({
        ...context,
        ...invalid,
      } as IRevenueCatAuthContext),
    ).rejects.toThrow(ETranslations.prime_onekey_id_session_changed__msg);
    expect(mockGetSecureItem).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([401, 90_002, 90_003])(
    'rejects server authentication failure %s',
    async (code) => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ code, message: 'test-token' }),
      });
      await expect(verifyRevenueCatIdentity(context)).rejects.toThrow(
        ETranslations.prime_onekey_id_session_changed__msg,
      );
    },
  );

  it('does not expose tokens or request headers in network errors', async () => {
    mockFetch.mockRejectedValue(
      new Error('network failure containing test-token'),
    );
    const error = await verifyRevenueCatIdentity(context).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({
      message: ETranslations.prime_onekey_id_session_changed__msg,
    });
    expect(String(error)).not.toContain('test-token');
  });

  it('rejects HTTP failures even if the response body looks successful', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ code: 0, data: profile }),
    });
    await expect(verifyRevenueCatIdentity(context)).rejects.toThrow(
      ETranslations.prime_onekey_id_session_changed__msg,
    );
  });

  it.each([
    {
      onekeyUserId: 'attacker',
      status: 'active',
      normalizedEmail: 'verified@example.com',
    },
    {
      onekeyUserId: 'user-a',
      status: 'merged',
      normalizedEmail: 'verified@example.com',
    },
    {
      onekeyUserId: 'user-a',
      status: 'active',
      normalizedEmail: 'v***@example.com',
    },
    {
      onekeyUserId: 'user-a',
      status: 'active',
      normalizedEmail: 'victim@example.com\nattacker@example.com',
    },
    {
      onekeyUserId: 'user-a',
      status: 'active',
      normalizedEmail: '\u202everified@example.com',
    },
    null,
  ])(
    'rejects an ambiguous or inconsistent server identity %#',
    async (account) => {
      profile.onekeyAccount = account;
      await expect(verifyRevenueCatIdentity(context)).rejects.toThrow(
        ETranslations.prime_onekey_id_session_changed__msg,
      );
    },
  );

  it('fails closed when subscription eligibility is absent', async () => {
    info = { userId: 'user-a' };
    await expect(verifyRevenueCatIdentity(context)).rejects.toThrow(
      ETranslations.prime_onekey_id_session_changed__msg,
    );
  });

  it('rejects a session replaced while server verification is in flight', async () => {
    mockFetch.mockImplementation(async (url) => {
      mockGetSecureItem.mockReturnValue(
        JSON.stringify({ access_token: 'replacement-token' }),
      );
      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: url.endsWith('/profile') ? profile : info,
        }),
      };
    });
    await expect(verifyRevenueCatIdentity(context)).rejects.toThrow(
      ETranslations.prime_onekey_id_session_changed__msg,
    );
  });

  it.each([undefined, JSON.stringify({ access_token: 'replacement-token' })])(
    'invalidates a verified identity when its session changes to %s',
    async (raw) => {
      const identity = await verifyRevenueCatIdentity(context);
      mockGetSecureItem.mockReturnValue(raw);
      expect(identity.assertCurrentSession).toThrow(
        ETranslations.prime_onekey_id_session_changed__msg,
      );
    },
  );

  it('shows the server-verified recipient in a native dialog with cancel as default', async () => {
    const identity = await verifyRevenueCatIdentity(context);
    await expect(confirmRevenueCatIdentity(identity)).resolves.toBe(true);
    expect(mockShowMessageBox).toHaveBeenCalledWith(
      mockWindow,
      expect.objectContaining({
        detail: `verified@example.com\n\n${ETranslations.prime_gift_account__desc}`,
        defaultId: 0,
        cancelId: 0,
        buttons: [ETranslations.global_cancel, ETranslations.global_confirm],
      }),
    );
    mockShowMessageBox.mockResolvedValueOnce({ response: 0 });
    await expect(confirmRevenueCatIdentity(identity)).resolves.toBe(false);
  });

  it('does not approve an identity when the main window is unavailable', async () => {
    const identity = await verifyRevenueCatIdentity(context);
    Object.defineProperty(globalThis, '$desktopMainAppFunctions', {
      configurable: true,
      value: undefined,
    });
    await expect(confirmRevenueCatIdentity(identity)).rejects.toThrow(
      ETranslations.prime_onekey_id_session_changed__msg,
    );
    expect(mockShowMessageBox).not.toHaveBeenCalled();
  });
});
