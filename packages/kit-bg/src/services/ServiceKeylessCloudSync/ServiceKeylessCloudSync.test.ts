import { LocalSecretEnvelopeUnavailable } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import systemTimeUtils, {
  ECloudSyncDataTimeSource,
} from '@onekeyhq/shared/src/utils/systemTimeUtils';

import localDb from '../../dbs/local/localDb';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';
import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import ServiceKeylessCloudSync from './ServiceKeylessCloudSync';

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    getCredentialInner: jest.fn(),
  },
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

jest.mock('../ServiceKeylessWallet/utils/keylessSyncCredentialStorage', () => ({
  __esModule: true,
  default: {
    getCredential: jest.fn(),
    removeAllCredentials: jest.fn(),
    saveCredential: jest.fn(),
  },
}));

describe('ServiceKeylessCloudSync', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('toggle keyless sync surfaces local secret envelope recovery dialog', async () => {
    const service = new ServiceKeylessCloudSync({
      backgroundApi: {
        servicePrime: {
          apiFetchPrimeUserInfo: jest.fn(),
        },
      },
    });
    const error = new LocalSecretEnvelopeUnavailable();
    const showDialog = jest
      .spyOn(errorToastUtils, 'showLocalSecretEnvelopeErrorDialogIfNeeded')
      .mockReturnValue(true);

    jest.spyOn(service, 'prepareCloudSyncKeyless').mockRejectedValue(error);
    const setCloudSyncEnabledKeyless = jest
      .spyOn(service, 'setCloudSyncEnabledKeyless')
      .mockResolvedValue(false);

    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
      }),
    ).rejects.toBe(error);

    expect(showDialog).toHaveBeenCalledWith(error);
    expect(setCloudSyncEnabledKeyless).toHaveBeenCalledWith(false);
  });

  test('silent keyless sync enable does not surface local secret envelope recovery dialog', async () => {
    const service = new ServiceKeylessCloudSync({
      backgroundApi: {
        servicePrime: {
          apiFetchPrimeUserInfo: jest.fn(),
        },
      },
    });
    const error = new LocalSecretEnvelopeUnavailable();
    const showDialog = jest
      .spyOn(errorToastUtils, 'showLocalSecretEnvelopeErrorDialogIfNeeded')
      .mockReturnValue(true);

    jest.spyOn(service, 'prepareCloudSyncKeyless').mockRejectedValue(error);
    const setCloudSyncEnabledKeyless = jest
      .spyOn(service, 'setCloudSyncEnabledKeyless')
      .mockResolvedValue(true);

    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        silentEnable: true,
        forceEnable: true,
      }),
    ).rejects.toBe(error);

    expect(showDialog).not.toHaveBeenCalled();
    expect(setCloudSyncEnabledKeyless).toHaveBeenCalledWith(true);
  });

  test('explicit keyless migration surfaces local secret envelope recovery without force-enabling', async () => {
    const service = new ServiceKeylessCloudSync({
      backgroundApi: {
        servicePrime: {
          apiFetchPrimeUserInfo: jest.fn(),
        },
      },
    });
    const error = new LocalSecretEnvelopeUnavailable();
    const showDialog = jest
      .spyOn(errorToastUtils, 'showLocalSecretEnvelopeErrorDialogIfNeeded')
      .mockReturnValue(true);

    const prepareCloudSyncKeyless = jest
      .spyOn(service, 'prepareCloudSyncKeyless')
      .mockRejectedValue(error);
    const setCloudSyncEnabledKeyless = jest
      .spyOn(service, 'setCloudSyncEnabledKeyless')
      .mockResolvedValue(false);

    await expect(
      service.toggleCloudSyncKeyless({
        enabled: true,
        silentEnable: true,
        forceEnable: true,
        handleLocalSecretEnvelopeUnavailable: true,
      }),
    ).rejects.toBe(error);

    expect(prepareCloudSyncKeyless).toHaveBeenCalledWith({
      silentEnable: true,
      throwOnLocalSecretEnvelopeUnavailable: true,
    });
    expect(showDialog).toHaveBeenCalledWith(error);
    expect(setCloudSyncEnabledKeyless).toHaveBeenCalledWith(false);
  });

  test('prepare keyless sync does not swallow local secret envelope repair errors', async () => {
    const service = new ServiceKeylessCloudSync({
      backgroundApi: {
        servicePassword: {
          promptPasswordVerify: jest.fn(async () => ({ password: 'pwd' })),
        },
      },
    });
    const error = new LocalSecretEnvelopeUnavailable();
    const repair = jest
      .spyOn(service, 'repairKeylessSyncCredentialIfNeeded')
      .mockRejectedValue(error);

    jest.spyOn(service, 'getKeylessWallet').mockResolvedValue({
      id: 'hd-keyless-wallet-id',
    } as Awaited<ReturnType<ServiceKeylessCloudSync['getKeylessWallet']>>);

    await expect(service.prepareCloudSyncKeyless()).rejects.toBe(error);

    expect(repair).toHaveBeenCalledWith({
      password: 'pwd',
      throwOnLocalSecretEnvelopeUnavailable: true,
    });
  });

  test('keyless credential repair detects local secret envelope errors by className', async () => {
    const service = new ServiceKeylessCloudSync({
      backgroundApi: {},
    });
    const error = {
      className: EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
      message: 'Local secret envelope wrapping key unavailable',
    };

    jest
      .spyOn(service, 'getCurrentCloudSyncKeylessWalletId')
      .mockResolvedValue('hd-keyless-wallet-id');
    jest
      .mocked(keylessSyncCredentialStorage.getCredential)
      .mockResolvedValue(null);
    jest.spyOn(localDb, 'getCredentialInner').mockRejectedValue(error);

    await expect(
      service.repairKeylessSyncCredentialIfNeeded({
        password: 'pwd',
        throwOnLocalSecretEnvelopeUnavailable: true,
      }),
    ).rejects.toBe(error);
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
