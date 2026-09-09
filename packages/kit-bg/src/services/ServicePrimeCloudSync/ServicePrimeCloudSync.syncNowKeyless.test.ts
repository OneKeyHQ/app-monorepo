import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';

import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';

import ServicePrimeCloudSync from './ServicePrimeCloudSync';

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

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBaseMock {
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }

    backgroundApi: unknown;
  },
}));

jest.mock('../../states/jotai/atoms', () => ({
  primeCloudSyncPersistAtom: {
    get: jest.fn(),
    set: jest.fn(),
  },
  addressBookPersistAtom: {},
  devSettingsPersistAtom: {},
  primeMasterPasswordPersistAtom: {},
  primePersistAtom: {},
}));

jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerAccount', () => ({
  CloudSyncFlowManagerAccount: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerAddressBook', () => ({
  CloudSyncFlowManagerAddressBook: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerBotWallet', () => ({
  CloudSyncFlowManagerBotWallet: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerBrowserBookmark', () => ({
  CloudSyncFlowManagerBrowserBookmark: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomNetwork', () => ({
  CloudSyncFlowManagerCustomNetwork: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomRpc', () => ({
  CloudSyncFlowManagerCustomRpc: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerCustomToken', () => ({
  CloudSyncFlowManagerCustomToken: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerIndexedAccount', () => ({
  CloudSyncFlowManagerIndexedAccount: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerLock', () => ({
  CloudSyncFlowManagerLock: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerMarketWatchList', () => ({
  CloudSyncFlowManagerMarketWatchList: jest.fn(),
}));
jest.mock('./CloudSyncFlowManager/CloudSyncFlowManagerWallet', () => ({
  CloudSyncFlowManagerWallet: jest.fn(),
}));

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../dbs/simple/simpleDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('./botWalletCloudSyncUtils', () => ({
  filterBotWalletRecordsByCurrentKeylessSyncScope: jest.fn(),
}));

jest.mock('./cloudSyncCheckUtils', () => ({
  buildOnlyCheckLocalDataTypes: jest.fn(),
}));

jest.mock('./cloudSyncItemBuilder', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('./keylessCloudSyncUtils', () => ({
  __esModule: true,
  default: {},
}));

type ISyncNowKeylessService = ServicePrimeCloudSync & {
  getSyncCredentialSafe: jest.Mock;
  initLocalSyncItemsDB: jest.Mock;
  startServerSyncFlow: jest.Mock;
  updateLastSyncTime: jest.Mock;
};

function buildService({
  isCloudSyncEnabledKeyless = true,
  syncCredential = {
    primeAccountSalt: 'prime-account-salt',
    securityPasswordR1: 'security-password-r1',
    masterPasswordUUID: 'master-password-uuid',
    keylessCredential: {
      keylessWalletId: 'hd-keyless-wallet-id',
      signingPrivateKey: 'signing-private-key',
      signingPublicKey: 'signing-public-key',
      encryptionKey: 'encryption-key',
      pwdHash: 'pwd-hash',
    },
  },
}: {
  isCloudSyncEnabledKeyless?: boolean;
  syncCredential?: Awaited<
    ReturnType<ServicePrimeCloudSync['getSyncCredentialSafe']>
  >;
} = {}) {
  const repairKeylessSyncCredentialIfNeeded = jest.fn(async () => undefined);
  const service = new ServicePrimeCloudSync({
    backgroundApi: {
      serviceKeylessCloudSync: {
        repairKeylessSyncCredentialIfNeeded,
      },
    },
  }) as ISyncNowKeylessService;

  jest.mocked(primeCloudSyncPersistAtom.get).mockResolvedValue({
    isCloudSyncEnabled: false,
    isCloudSyncEnabledKeyless,
  });
  service.getSyncCredentialSafe = jest.fn(async () => syncCredential);
  const emptyLocalSyncItems: Awaited<
    ReturnType<ServicePrimeCloudSync['initLocalSyncItemsDB']>
  > = {
    allWallets: [],
    allDevices: undefined,
    allAccounts: [],
    allIndexedAccounts: [],
  };
  service.initLocalSyncItemsDB = jest.fn(async () => emptyLocalSyncItems);
  service.startServerSyncFlow = jest.fn(async () => undefined);
  service.updateLastSyncTime = jest.fn(async () => undefined);

  return {
    service,
    repairKeylessSyncCredentialIfNeeded,
  };
}

describe('ServicePrimeCloudSync.syncNowKeyless', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('manual keyless sync repairs credential with local secret envelope errors enabled', async () => {
    const { service, repairKeylessSyncCredentialIfNeeded } = buildService();

    await expect(
      service.syncNowKeyless({
        password: 'pwd',
      }),
    ).resolves.toBe(true);

    expect(repairKeylessSyncCredentialIfNeeded).toHaveBeenCalledWith({
      password: 'pwd',
      throwOnLocalSecretEnvelopeUnavailable: true,
    });
    expect(service.startServerSyncFlow).toHaveBeenCalledWith({
      callerName: 'Manual Cloud Sync Keyless',
      noDebounceUpload: true,
      forceSync: undefined,
    });
    expect(service.updateLastSyncTime).toHaveBeenCalledWith({
      syncMode: ECloudSyncMode.Keyless,
    });
  });

  test('manual keyless sync rethrows local secret envelope repair errors before sync starts', async () => {
    const { service, repairKeylessSyncCredentialIfNeeded } = buildService();
    const error = {
      className: EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
      message: 'Local secret envelope wrapping key unavailable',
    };
    repairKeylessSyncCredentialIfNeeded.mockRejectedValue(error);

    await expect(
      service.syncNowKeyless({
        password: 'pwd',
      }),
    ).rejects.toBe(error);

    expect(service.getSyncCredentialSafe).not.toHaveBeenCalled();
    expect(service.initLocalSyncItemsDB).not.toHaveBeenCalled();
    expect(service.startServerSyncFlow).not.toHaveBeenCalled();
    expect(service.updateLastSyncTime).not.toHaveBeenCalled();
  });

  test('manual keyless sync returns false without success side effects when sync cannot run', async () => {
    const { service, repairKeylessSyncCredentialIfNeeded } = buildService();
    service.getSyncCredentialSafe = jest.fn(async () => undefined);

    await expect(
      service.syncNowKeyless({
        password: 'pwd',
      }),
    ).resolves.toBe(false);

    expect(repairKeylessSyncCredentialIfNeeded).toHaveBeenCalledWith({
      password: 'pwd',
      throwOnLocalSecretEnvelopeUnavailable: true,
    });
    expect(service.initLocalSyncItemsDB).not.toHaveBeenCalled();
    expect(service.startServerSyncFlow).not.toHaveBeenCalled();
    expect(service.updateLastSyncTime).not.toHaveBeenCalled();
  });

  test('keyless sync without password skips local credential repair', async () => {
    const { service, repairKeylessSyncCredentialIfNeeded } = buildService();

    await expect(
      service.syncNowKeyless({
        callerName: 'Keyless Wallet Login Success',
        noDebounceUpload: true,
        forceSync: true,
      }),
    ).resolves.toBe(true);

    expect(repairKeylessSyncCredentialIfNeeded).not.toHaveBeenCalled();
    expect(service.initLocalSyncItemsDB).toHaveBeenCalledWith({
      syncCredential: expect.objectContaining({
        primeAccountSalt: 'prime-account-salt',
      }),
      password: undefined,
    });
    expect(service.startServerSyncFlow).toHaveBeenCalledWith({
      callerName: 'Keyless Wallet Login Success',
      noDebounceUpload: true,
      forceSync: true,
    });
  });
});
