import { ONEKEY_ID_AUTH_CONFIG } from '@onekeyhq/shared/src/consts/authConsts';
import requestHelper from '@onekeyhq/shared/src/request/requestHelper';
import { getSupabaseAuthSessionKey } from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import {
  allowAuthSessionStorageWritesBySessionSource,
  readPersistedAccessTokenBySessionSourceStrict,
  removeAuthSessionStorageBySessionSource,
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
  };
}>('@onekeyhq/shared/src/storage/instance/supabaseStorageInstance').default;

describe('email session storage follows the OneKey node environment', () => {
  beforeEach(() => jest.clearAllMocks());

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
});
