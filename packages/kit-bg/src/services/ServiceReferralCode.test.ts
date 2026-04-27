/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */

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
