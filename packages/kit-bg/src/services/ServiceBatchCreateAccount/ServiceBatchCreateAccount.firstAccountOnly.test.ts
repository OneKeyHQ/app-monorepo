/*
yarn jest packages/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount.firstAccountOnly.test.ts

A network with one account per wallet (Lightning Self-Custody) builds only
index 0 in a bulk preview or create. The other indexes leave the progress
total, so the create dialog completes and counts only the account built.
*/

import ServiceBatchCreateAccount from '@onekeyhq/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    hardware: { sdkLog: { consoleLog: jest.fn(), log: jest.fn() } },
    account: {
      batchCreatePerf: new Proxy({}, { get: () => jest.fn() }),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountUpdate: 'AccountUpdate',
    AddDBAccountsToWallet: 'AddDBAccountsToWallet',
    BatchCreateAccount: 'BatchCreateAccount',
  },
  appEventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
}));

jest.mock('@onekeyhq/core/src/secret', () => ({
  clearHdCredentialDecryptCache: jest.fn(async () => undefined),
}));

jest.mock('@onekeyhq/kit-bg/src/dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  primeTransferAtom: { set: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { showLocalSecretEnvelopeErrorDialogIfNeeded: jest.fn() },
}));

jest.mock('@onekeyhq/kit-bg/src/vaults/settings', () => ({
  getVaultSettings: jest.fn(async ({ networkId }: { networkId: string }) => ({
    firstAccountOnly: networkId === 'lightningspark--0',
  })),
}));

const SPARK = 'lightningspark--0';
const eventBus = appEventBus as unknown as Record<'emit', jest.Mock>;

function setup() {
  const prepared: number[][] = [];
  const saved: unknown[] = [];
  const service = new ServiceBatchCreateAccount({
    backgroundApi: {
      serviceAccount: {
        getWalletDeviceParams: async () => undefined,
        // Like the Spark keyring, which refuses every index but 0.
        prepareHdOrHwAccounts: async ({ indexes }: { indexes: number[] }) => {
          prepared.push(indexes);
          if (indexes.some((index) => index !== 0)) {
            throw new OneKeyLocalError(
              'Spark supports only one account per wallet',
            );
          }
          return {
            vault: {
              getNetworkInfo: async () => ({}),
              buildAccountAddressDetail: async () => ({
                address: 'spark address',
              }),
            },
            accounts: [{ pathIndex: 0, address: 'spark address' }],
          };
        },
        addBatchCreatedHdOrHwAccount: async (params: unknown) => {
          saved.push(params);
        },
      },
      servicePrimeTransfer: {
        isInTransferImportOrBackupRestoreFlow: async () => false,
        recordImportBatchCreateTrace: async () => undefined,
      },
    },
  });
  jest.spyOn(service, 'updateAccountExistsInDb').mockResolvedValue(undefined);
  return { service, prepared, saved };
}

describe('ServiceBatchCreateAccount on a first-account-only network', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('previews the first account instead of failing on later indexes', async () => {
    const { service, prepared } = setup();

    const { accountsForCreate } = await service.batchBuildAccounts({
      walletId: 'hd-1',
      networkId: SPARK,
      deriveType: 'default',
      indexes: [0, 1, 2],
      saveToDb: false,
    } as never);

    expect(prepared).toEqual([[0]]);
    expect(accountsForCreate).toHaveLength(1);
    expect(accountsForCreate[0]).toMatchObject({ pathIndex: 0 });
  });

  it('drops the skipped indexes from the total so the create progress completes', async () => {
    const { service, prepared, saved } = setup();
    service.progressInfo = service.buildProgressInfo({ indexes: [0, 1, 2] });

    await service.batchBuildAccounts({
      walletId: 'hd-1',
      networkId: SPARK,
      deriveType: 'default',
      indexes: [0, 1, 2],
      saveToDb: true,
      showUIProgress: true,
    } as never);

    expect(prepared).toEqual([[0]]);
    expect(saved).toHaveLength(1);
    // The dialog shows progressCurrent as the number of addresses added.
    expect(service.progressInfo).toMatchObject({
      progressCurrent: 1,
      progressTotal: 1,
      createdCount: 1,
    });
    const progressEvents = eventBus.emit.mock.calls.filter(
      ([name]) => name === 'BatchCreateAccount',
    );
    expect(progressEvents.at(-1)?.[1]).toMatchObject({
      progressCurrent: 1,
      progressTotal: 1,
    });
  });
});
