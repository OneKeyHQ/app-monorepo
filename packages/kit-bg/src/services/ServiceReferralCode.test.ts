/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */

import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import { buildLegacyWalletCreatedAtFallback } from '@onekeyhq/shared/src/referralCode/creationRecordUtils';

import ServiceReferralCode from './ServiceReferralCode';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
  checkDevOnlyPassword: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: jest.fn(),
    getRawDataClient: jest.fn(),
  },
}));

jest.mock('../endpoints', () => ({
  getEndpointInfo: jest.fn(async () => ({
    endpoint: 'https://test.onekey.so',
  })),
}));

jest.mock('../states/jotai/atoms/devSettings', () => ({
  devSettingsPersistAtom: {
    get: jest.fn(async () => ({ enabled: false, settings: {} })),
    set: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      subscription: {},
    },
    app: {
      error: {
        log: jest.fn(),
      },
    },
  },
}));

function createWallet(
  walletId = 'hd-1',
  overrides: Record<string, unknown> = {},
) {
  return {
    id: walletId,
    name: 'Wallet 1',
    type: 'hd',
    backuped: true,
    accounts: [],
    nextIds: {},
    walletNo: 1,
    ...overrides,
  } as any;
}

function createService() {
  const backgroundApi: any = {
    simpleDb: {
      referralCode: {
        isCreationRecordsMigrationDone: jest.fn(),
        setCreationRecordsMigrationDone: jest.fn(),
        getWalletCreationRecordTimestamp: jest.fn(),
        setWalletCreationRecordTimestamp: jest.fn(),
        getWalletReferralCode: jest.fn(),
        setWalletReferralCode: jest.fn(),
      },
    },
    serviceAccount: {
      getWallets: jest.fn(),
      getDevice: jest.fn(),
    },
    serviceHardware: {},
  };

  const service = new ServiceReferralCode({ backgroundApi });
  backgroundApi.serviceReferralCode = service;

  jest.spyOn(service, 'recordWalletCreation').mockResolvedValue(undefined);
  jest.spyOn(service, 'getReferralCodeWalletInfo').mockImplementation(
    async ({ walletId }: { walletId: string }) =>
      ({
        walletId,
        accountId: `${walletId}--m/44'/60'/0'/0/0`,
        address: '0xabc',
        networkId: 'evm--1',
      }) as any,
  );

  return { service, backgroundApi };
}

describe('ServiceReferralCode migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('keeps migration retryable when there are no wallets yet', async () => {
    const { service, backgroundApi } = createService();

    backgroundApi.simpleDb.referralCode.isCreationRecordsMigrationDone.mockResolvedValue(
      false,
    );
    backgroundApi.serviceAccount.getWallets.mockResolvedValue({
      wallets: [],
    });

    await service.migrateCreationRecordsIfNeeded();

    expect(service.recordWalletCreation).not.toHaveBeenCalled();
    expect(
      backgroundApi.simpleDb.referralCode.setCreationRecordsMigrationDone,
    ).not.toHaveBeenCalled();
  });

  test('reuses the cached walletCreatedAt when backfilling migration records', async () => {
    const { service, backgroundApi } = createService();

    backgroundApi.simpleDb.referralCode.isCreationRecordsMigrationDone.mockResolvedValue(
      false,
    );
    backgroundApi.simpleDb.referralCode.getWalletCreationRecordTimestamp.mockResolvedValue(
      '2026-04-01T00:00:00.000Z',
    );
    backgroundApi.serviceAccount.getWallets.mockResolvedValue({
      wallets: [createWallet('hd-1')],
    });

    await (service as any)._doMigrateCreationRecords();

    expect(service.recordWalletCreation).toHaveBeenCalledWith([
      {
        address: '0xabc',
        networkId: 'evm--1',
        walletCreatedAt: '2026-04-01T00:00:00.000Z',
      },
    ]);
    expect(
      backgroundApi.simpleDb.referralCode.setWalletCreationRecordTimestamp,
    ).not.toHaveBeenCalled();
    expect(
      backgroundApi.simpleDb.referralCode.setCreationRecordsMigrationDone,
    ).toHaveBeenCalledTimes(1);
  });

  test('caches a conservative legacy timestamp when no local creation time exists', async () => {
    const { service, backgroundApi } = createService();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);

    backgroundApi.simpleDb.referralCode.isCreationRecordsMigrationDone.mockResolvedValue(
      false,
    );
    backgroundApi.simpleDb.referralCode.getWalletCreationRecordTimestamp.mockResolvedValue(
      undefined,
    );
    backgroundApi.serviceAccount.getWallets.mockResolvedValue({
      wallets: [createWallet('hd-1')],
    });

    await (service as any)._doMigrateCreationRecords();

    const expectedWalletCreatedAt = buildLegacyWalletCreatedAtFallback({
      now: 1_710_000_000_000,
    });
    expect(
      backgroundApi.simpleDb.referralCode.setWalletCreationRecordTimestamp,
    ).toHaveBeenCalledWith({
      walletId: 'hd-1',
      walletCreatedAt: expectedWalletCreatedAt,
    });
    expect(service.recordWalletCreation).toHaveBeenCalledWith([
      {
        address: '0xabc',
        networkId: 'evm--1',
        walletCreatedAt: expectedWalletCreatedAt,
      },
    ]);

    nowSpy.mockRestore();
  });
});

describe('ServiceReferralCode.checkWalletBindStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses V2 bound false with expired reason as unbound expired', async () => {
    const { service } = createService();
    const post = jest.fn().mockResolvedValue({
      data: {
        data: {
          'evm--1:0xabc': {
            bound: false,
            bindable: false,
            reason: 'exceeded_bind_window',
          },
        },
      },
    });
    (appApiClient.getClient as unknown as jest.Mock).mockResolvedValue({
      post,
    });

    await expect(
      service.checkWalletBindStatus({
        address: '0xabc',
        networkId: 'evm--1',
      }),
    ).resolves.toEqual({
      data: false,
      bindable: false,
      reason: 'exceeded_bind_window',
    });
    expect(post).toHaveBeenCalledTimes(1);
  });

  test('uses V2 bound true as bound even with expired reason', async () => {
    const { service } = createService();
    const post = jest.fn().mockResolvedValue({
      data: {
        data: {
          'evm--1:0xabc': {
            bound: true,
            bindable: false,
            reason: 'exceeded_bind_window',
          },
        },
      },
    });
    (appApiClient.getClient as unknown as jest.Mock).mockResolvedValue({
      post,
    });

    await expect(
      service.checkWalletBindStatus({
        address: '0xabc',
        networkId: 'evm--1',
      }),
    ).resolves.toEqual({
      data: true,
      bindable: false,
      reason: undefined,
    });
  });

  test('treats V2 already_bound reason as bound', async () => {
    const { service } = createService();
    const post = jest.fn().mockResolvedValue({
      data: {
        data: {
          'evm--1:0xabc': {
            bound: false,
            bindable: false,
            reason: 'already_bound',
          },
        },
      },
    });
    (appApiClient.getClient as unknown as jest.Mock).mockResolvedValue({
      post,
    });

    await expect(
      service.checkWalletBindStatus({
        address: '0xabc',
        networkId: 'evm--1',
      }),
    ).resolves.toEqual({
      data: true,
      bindable: false,
      reason: undefined,
    });
  });

  test('treats V2 unbound non-expired status as bindable', async () => {
    const { service } = createService();
    const post = jest.fn().mockResolvedValue({
      data: {
        data: {
          'evm--1:0xabc': {
            bound: false,
            bindable: false,
          },
        },
      },
    });
    (appApiClient.getClient as unknown as jest.Mock).mockResolvedValue({
      post,
    });

    await expect(
      service.checkWalletBindStatus({
        address: '0xabc',
        networkId: 'evm--1',
      }),
    ).resolves.toEqual({
      data: false,
      bindable: true,
      reason: undefined,
    });
  });

  test('throws unknown when V2 omits the wallet item', async () => {
    const { service } = createService();
    const post = jest.fn().mockResolvedValue({
      data: {
        data: {},
      },
    });
    (appApiClient.getClient as unknown as jest.Mock).mockResolvedValue({
      post,
    });

    await expect(
      service.checkWalletBindStatus({
        address: '0xabc',
        networkId: 'evm--1',
      }),
    ).rejects.toThrow('Missing wallet referral bind status');
  });
});

describe('ServiceReferralCode.checkAndUpdateReferralCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('revalidates locally bound wallets before returning them', async () => {
    const { service, backgroundApi } = createService();
    const boundStatus = {
      walletId: 'hd-1',
      address: '0xabc',
      networkId: 'evm--1',
      pubkey: '',
      isBound: true,
      bindable: false,
    };

    backgroundApi.simpleDb.referralCode.getWalletReferralCode.mockResolvedValue(
      boundStatus,
    );
    const checkWalletBindStatusSpy = jest
      .spyOn(service, 'checkWalletBindStatus')
      .mockResolvedValue({
        data: true,
        bindable: false,
        reason: undefined,
      });

    await expect(
      service.checkAndUpdateReferralCode({
        accountId: "hd-1--m/44'/60'/0'/0/0",
      }),
    ).resolves.toBe(boundStatus);

    expect(checkWalletBindStatusSpy).toHaveBeenCalledWith({
      address: '0xabc',
      networkId: 'evm--1',
    });
    expect(
      backgroundApi.simpleDb.referralCode.setWalletReferralCode,
    ).not.toHaveBeenCalled();
  });

  test('drops stale locally bound wallets when the server no longer confirms binding', async () => {
    const { service, backgroundApi } = createService();
    const boundStatus = {
      walletId: 'hd-1',
      address: '0xabc',
      networkId: 'evm--1',
      pubkey: '',
      isBound: true,
      bindable: false,
    };

    backgroundApi.simpleDb.referralCode.getWalletReferralCode.mockResolvedValue(
      boundStatus,
    );
    const checkWalletBindStatusSpy = jest
      .spyOn(service, 'checkWalletBindStatus')
      .mockResolvedValue({
        data: false,
        bindable: false,
        reason: 'exceeded_bind_window',
      });

    await expect(
      service.checkAndUpdateReferralCode({
        accountId: "hd-1--m/44'/60'/0'/0/0",
      }),
    ).resolves.toBeUndefined();

    expect(checkWalletBindStatusSpy).toHaveBeenCalledWith({
      address: '0xabc',
      networkId: 'evm--1',
    });
    expect(
      backgroundApi.simpleDb.referralCode.setWalletReferralCode,
    ).not.toHaveBeenCalled();
  });

  test('does not write local bind data when refresh sees a bound wallet', async () => {
    const { service, backgroundApi } = createService();
    const unboundStatus = {
      walletId: 'hd-1',
      address: '0xabc',
      networkId: 'evm--1',
      pubkey: '',
      isBound: false,
      bindable: true,
    };

    backgroundApi.simpleDb.referralCode.getWalletReferralCode.mockResolvedValue(
      unboundStatus,
    );
    jest.spyOn(service, 'checkWalletBindStatus').mockResolvedValue({
      data: true,
      bindable: false,
      reason: undefined,
    });

    await expect(
      service.checkAndUpdateReferralCode({
        accountId: "hd-1--m/44'/60'/0'/0/0",
      }),
    ).resolves.toBe(unboundStatus);

    expect(
      backgroundApi.simpleDb.referralCode.setWalletReferralCode,
    ).not.toHaveBeenCalled();
  });
});
