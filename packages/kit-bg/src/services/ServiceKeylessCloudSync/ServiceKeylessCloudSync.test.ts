import systemTimeUtils, {
  ECloudSyncDataTimeSource,
} from '@onekeyhq/shared/src/utils/systemTimeUtils';

import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import ServiceKeylessCloudSync from './ServiceKeylessCloudSync';

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../states/jotai/atoms', () => ({
  primeCloudSyncPersistAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const passthroughDecorator =
    () =>
    (...args: unknown[]) =>
      args.length === 1 ? args[0] : args[2];

  return {
    backgroundClass: passthroughDecorator,
    backgroundMethod: passthroughDecorator,
    backgroundMethodForDev: passthroughDecorator,
    toastIfError: passthroughDecorator,
  };
});

describe('ServiceKeylessCloudSync', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('silent keyless sync enable replays scene sync items', async () => {
    const startServerSyncFlow = jest.fn(async () => undefined);
    const service = new ServiceKeylessCloudSync({
      backgroundApi: {
        servicePrimeCloudSync: {
          startServerSyncFlow,
        },
        servicePrime: {
          apiFetchPrimeUserInfo: jest.fn(),
        },
      },
    });

    jest
      .spyOn(service, 'prepareCloudSyncKeyless')
      .mockResolvedValue({ success: true });
    jest.spyOn(service, 'setCloudSyncEnabledKeyless').mockResolvedValue(true);

    await service.toggleCloudSyncKeyless({
      enabled: true,
      silentEnable: true,
    });

    expect(startServerSyncFlow).toHaveBeenCalledWith({
      setUndefinedTimeToNow: true,
      callerName: 'Enable Keyless Cloud Sync',
      forceSync: true,
    });
  });

  test('keyless signature header uses corrected estimated time', async () => {
    const correctedTimestamp = 1_800_000_000_000;
    jest.spyOn(systemTimeUtils, 'getCorrectedCloudSyncNow').mockReturnValue({
      time: correctedTimestamp,
      source: ECloudSyncDataTimeSource.Estimated,
    });
    jest
      .spyOn(systemTimeUtils, 'hasFreshServerTimeInCurrentProcess')
      .mockReturnValue(true);
    const ensureFreshServerTime = jest
      .spyOn(systemTimeUtils, 'ensureFreshServerTime')
      .mockResolvedValue(true);
    const buildKeylessSignatureHeader = jest
      .spyOn(keylessCloudSyncUtils, 'buildKeylessSignatureHeader')
      .mockReturnValue('signature-header');

    const service = new ServiceKeylessCloudSync({
      backgroundApi: {
        servicePrimeCloudSync: {
          getSyncCredentialSafe: jest.fn(async () => ({
            keylessCredential: {
              keylessWalletId: 'keyless-wallet-id',
              signingPrivateKey: 'signing-private-key',
              signingPublicKey: 'signing-public-key',
              encryptionKey: 'encryption-key',
              pwdHash: 'pwd-hash',
            },
          })),
        },
      },
    });

    const auth = await service.getKeylessSyncAuth({
      postData: {
        foo: 'bar',
      },
    });

    expect(ensureFreshServerTime).not.toHaveBeenCalled();
    expect(buildKeylessSignatureHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: correctedTimestamp,
      }),
    );
    expect(auth?.signatureHeader).toBe('signature-header');
  });

  test('keyless signature header ensures fresh server time before signing', async () => {
    const refreshedTimestamp = 1_800_000_000_000;
    jest.spyOn(systemTimeUtils, 'getCorrectedCloudSyncNow').mockReturnValue({
      time: refreshedTimestamp,
      source: ECloudSyncDataTimeSource.Estimated,
    });
    jest
      .spyOn(systemTimeUtils, 'hasFreshServerTimeInCurrentProcess')
      .mockReturnValue(false);
    const ensureFreshServerTime = jest
      .spyOn(systemTimeUtils, 'ensureFreshServerTime')
      .mockResolvedValue(true);
    const buildKeylessSignatureHeader = jest
      .spyOn(keylessCloudSyncUtils, 'buildKeylessSignatureHeader')
      .mockReturnValue('signature-header');

    const service = new ServiceKeylessCloudSync({
      backgroundApi: {
        servicePrimeCloudSync: {
          getSyncCredentialSafe: jest.fn(async () => ({
            keylessCredential: {
              keylessWalletId: 'keyless-wallet-id',
              signingPrivateKey: 'signing-private-key',
              signingPublicKey: 'signing-public-key',
              encryptionKey: 'encryption-key',
              pwdHash: 'pwd-hash',
            },
          })),
        },
      },
    });

    await service.getKeylessSyncAuth({
      postData: {
        foo: 'bar',
      },
    });

    expect(ensureFreshServerTime).toHaveBeenCalledTimes(1);
    expect(buildKeylessSignatureHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: refreshedTimestamp,
      }),
    );
  });

  test('keyless signature header falls back to local now for stale corrected time', async () => {
    const appBuildTimestamp = 1_747_527_766_656;
    const localTimestamp = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(localTimestamp);
    jest.spyOn(systemTimeUtils, 'getCorrectedCloudSyncNow').mockReturnValue({
      time: appBuildTimestamp,
      source: ECloudSyncDataTimeSource.AppBuild,
    });
    jest
      .spyOn(systemTimeUtils, 'hasFreshServerTimeInCurrentProcess')
      .mockReturnValue(false);
    const ensureFreshServerTime = jest
      .spyOn(systemTimeUtils, 'ensureFreshServerTime')
      .mockResolvedValue(false);
    const buildKeylessSignatureHeader = jest
      .spyOn(keylessCloudSyncUtils, 'buildKeylessSignatureHeader')
      .mockReturnValue('signature-header');

    const service = new ServiceKeylessCloudSync({
      backgroundApi: {
        servicePrimeCloudSync: {
          getSyncCredentialSafe: jest.fn(async () => ({
            keylessCredential: {
              keylessWalletId: 'keyless-wallet-id',
              signingPrivateKey: 'signing-private-key',
              signingPublicKey: 'signing-public-key',
              encryptionKey: 'encryption-key',
              pwdHash: 'pwd-hash',
            },
          })),
        },
      },
    });

    await service.getKeylessSyncAuth({
      postData: {
        foo: 'bar',
      },
    });

    expect(ensureFreshServerTime).toHaveBeenCalledTimes(1);
    expect(buildKeylessSignatureHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: localTimestamp,
      }),
    );
  });
});
