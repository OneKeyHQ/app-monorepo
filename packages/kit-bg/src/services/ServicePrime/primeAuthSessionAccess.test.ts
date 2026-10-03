import { ONEKEY_ID_AUTH_CONFIG } from '@onekeyhq/shared/src/consts/authConsts';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import {
  getKeylessSupabaseAuthSessionKey,
  getSupabaseAuthSessionKey,
} from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  allowAuthSessionStorageWritesBySessionSource,
  clearEmailAuthSessionsForEnvironmentChange,
  readPersistedAccessTokenBySessionSourceStrict,
  removeAuthSessionStorageBySessionSource,
  runExclusiveOnAuthSessionSlot,
} from './primeAuthSessionAccess';

jest.mock('@onekeyhq/shared/src/request/requestHelper', () => ({
  __esModule: true,
  default: { getDevSettingsPersistAtom: jest.fn() },
}));

jest.mock(
  '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance',
  () => ({
    __esModule: true,
    default: {
      allowWritesForKey: jest.fn(),
      blockWritesForKey: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
      clearCache: jest.fn(),
    },
  }),
);

const storage = jest.requireMock<{
  default: {
    allowWritesForKey: jest.Mock<void, [string]>;
    blockWritesForKey: jest.Mock<Promise<void>, [string]>;
    getItem: jest.Mock<Promise<string | null>, [string]>;
    removeItem: jest.Mock<Promise<void>, [string]>;
    clearCache: jest.Mock;
  };
}>('@onekeyhq/shared/src/storage/instance/supabaseStorageInstance').default;

describe('email session storage follows the OneKey node environment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.blockWritesForKey.mockReset().mockResolvedValue();
    storage.removeItem.mockReset().mockResolvedValue();
  });

  test.each(['prod', 'test'] as const)(
    '%s reads and mutates only its project session',
    async (environment) => {
      jest.mocked(requestHelper.getDevSettingsPersistAtom).mockResolvedValue({
        enabled: true,
        settings: { enableTestEndpoint: environment === 'test' },
      });
      jest
        .mocked(storage.getItem)
        .mockResolvedValue(JSON.stringify({ access_token: 'fixture-token' }));
      const key = getSupabaseAuthSessionKey(
        ONEKEY_ID_AUTH_CONFIG[environment].projectUrl,
      );
      const source = EPrimeAuthSessionSource.LegacyEmailSupabase;
      await allowAuthSessionStorageWritesBySessionSource(source);
      expect(storage.allowWritesForKey).toHaveBeenCalledWith(key);
      await expect(
        readPersistedAccessTokenBySessionSourceStrict(source),
      ).resolves.toEqual({ status: 'ok', accessToken: 'fixture-token' });
      expect(storage.getItem).toHaveBeenCalledWith(key);
      await removeAuthSessionStorageBySessionSource(source);
      expect(storage.blockWritesForKey).toHaveBeenCalledWith(key);
      expect(storage.removeItem).toHaveBeenCalledTimes(1);
      expect(storage.removeItem).toHaveBeenCalledWith(key);
    },
  );

  test('clears both email realms and PKCE data without touching the Keyless wallet session', async () => {
    await clearEmailAuthSessionsForEnvironmentChange();
    for (const config of [
      ONEKEY_ID_AUTH_CONFIG.prod,
      ONEKEY_ID_AUTH_CONFIG.test,
    ]) {
      const key = getSupabaseAuthSessionKey(config.projectUrl);
      expect(storage.blockWritesForKey).toHaveBeenCalledWith(key);
      expect(storage.removeItem).toHaveBeenCalledWith(key);
      expect(storage.removeItem).toHaveBeenCalledWith(`${key}-user`);
      expect(storage.removeItem).toHaveBeenCalledWith(`${key}-code-verifier`);
    }
    expect(storage.blockWritesForKey).toHaveBeenCalledTimes(2);
    expect(storage.removeItem).toHaveBeenCalledTimes(6);
    expect(storage.removeItem).not.toHaveBeenCalledWith(
      getKeylessSupabaseAuthSessionKey(),
    );
    expect(storage.clearCache).toHaveBeenCalled();
  });

  test('propagates a storage failure to prevent switching with a stale target session', async () => {
    storage.removeItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(clearEmailAuthSessionsForEnvironmentChange()).rejects.toThrow(
      'storage unavailable',
    );
    expect(storage.clearCache).toHaveBeenCalled();
  });

  test('holds the slot lock until every removal settles after an early failure', async () => {
    let finishRemoval!: () => void;
    let noteRemovalStarted!: () => void;
    const removalStarted = new Promise<void>((resolve) => {
      noteRemovalStarted = resolve;
    });
    const failure = new Error('one slot unavailable');
    storage.removeItem
      .mockRejectedValueOnce(failure)
      .mockImplementationOnce(() => {
        noteRemovalStarted();
        return new Promise<void>((resolve) => {
          finishRemoval = resolve;
        });
      });
    const cleanup = clearEmailAuthSessionsForEnvironmentChange().catch(
      (error: unknown) => error,
    );
    await removalStarted;
    const nextLogin = jest.fn();
    const next = runExclusiveOnAuthSessionSlot(
      EPrimeAuthSessionSource.LegacyEmailSupabase,
      async () => {
        nextLogin();
      },
    );
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    const enteredBeforeRemoval = nextLogin.mock.calls.length;
    finishRemoval();
    expect(await cleanup).toBe(failure);
    await next;
    expect(enteredBeforeRemoval).toBe(0);
    expect(nextLogin).toHaveBeenCalledTimes(1);
    expect(storage.allowWritesForKey).not.toHaveBeenCalled();
  });
});
