import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core/errors';

import ServiceBatchCreateAccount from '@onekeyhq/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  ThirdPartyAppNotInstalled,
  ThirdPartyInstallAppUserCancelled,
} from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { classifyThirdPartyHwCreateFailures } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
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
    hardware: {
      sdkLog: {
        consoleLog: jest.fn(),
        log: jest.fn(),
      },
    },
    account: {
      batchCreatePerf: new Proxy(
        {},
        {
          get: () => jest.fn(),
        },
      ),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountUpdate: 'AccountUpdate',
    BatchCreateAccount: 'BatchCreateAccount',
  },
  appEventBus: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
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

function setup(failure: unknown, failAllNetworks = false) {
  const attempted: string[] = [];
  const saved: string[] = [];
  const service = new ServiceBatchCreateAccount({
    backgroundApi: {
      serviceAccount: {
        getWalletDeviceParams: async () => undefined,
        prepareHdOrHwAccounts: async ({ networkId }: { networkId: string }) => {
          attempted.push(networkId);
          if (failAllNetworks || networkId === 'btc--0') throw failure;
          return {
            vault: {
              getNetworkInfo: async () => ({}),
              buildAccountAddressDetail: async () => ({
                address: 'synthetic address',
              }),
            },
            accounts: [{ pathIndex: 0, address: 'synthetic address' }],
          };
        },
        addBatchCreatedHdOrHwAccount: async ({
          networkId,
        }: {
          networkId: string;
        }) => {
          saved.push(networkId);
        },
      },
      serviceHardwareUI: {
        withHardwareProcessing: async (fn: () => Promise<unknown>) => fn(),
      },
      servicePrimeTransfer: {
        isInTransferImportOrBackupRestoreFlow: async () => true,
        recordImportBatchCreateTrace: async () => undefined,
      },
    },
  });
  jest
    .spyOn(service, 'getHwAllNetworkPrepareAccountsResponse')
    .mockResolvedValue(undefined);
  jest.spyOn(service, 'updateAccountExistsInDb').mockResolvedValue(undefined);
  const run = (autoHandleExitError = true) =>
    service.startBatchCreateAccountsFlowForAllNetwork({
      walletId: 'hd-1',
      fromIndex: 0,
      toIndex: 0,
      excludedIndexes: {},
      saveToDb: true,
      includingDefaultNetworks: false,
      autoHandleExitError,
      applyRestoreSyncPolicy: true,
      customNetworks: [
        { networkId: 'evm--1', deriveType: 'default' },
        { networkId: 'btc--0', deriveType: 'BIP86' },
        { networkId: 'sol--101', deriveType: 'default' },
      ],
    });
  return { run, attempted, saved };
}

afterEach(() => jest.restoreAllMocks());

it('continues to the next network for an isolated derivation failure', async () => {
  const { run, attempted, saved } = setup(
    new OneKeyLocalError('synthetic invalid derivation'),
  );
  const result = await run();
  expect(attempted).toEqual(['evm--1', 'btc--0', 'sol--101']);
  expect(saved).toEqual(['evm--1', 'sol--101']);
  expect(result.failedAccounts).toEqual([
    expect.objectContaining({ networkId: 'btc--0', deriveType: 'BIP86' }),
  ]);
});

it.each([
  EOneKeyErrorClassNames.IncorrectPassword,
  EOneKeyErrorClassNames.IncorrectPinError,
  EOneKeyErrorClassNames.WrongPassword,
  EOneKeyErrorClassNames.PasswordPromptDialogCancel,
  EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
  EOneKeyErrorClassNames.LocalDbOpenError,
])('does not request another network after %s', async (className) => {
  const error = { className };
  const { run, attempted, saved } = setup(error);
  await expect(run()).rejects.toBe(error);
  expect(attempted).toEqual(['evm--1', 'btc--0']);
  expect(saved).toEqual(['evm--1']);
});

it.each([
  HardwareErrorCode.ActionCancelled,
  HardwareErrorCode.PinInvalid,
  HardwareErrorCode.WebDeviceNotFoundOrNeedsPermission,
  HardwareErrorCode.BleDeviceDisconnected,
  ThirdPartyHwErrorCode.UserRejected,
  ThirdPartyHwErrorCode.PinCancelled,
])('does not reconnect after hardware error %s', async (code) => {
  const error = {
    className: EOneKeyErrorClassNames.OneKeyHardwareError,
    payload: { code },
  };
  const { run, attempted } = setup(error);
  await expect(run()).rejects.toBe(error);
  expect(attempted).toEqual(['evm--1', 'btc--0']);
});

it('preserves explicit fail-fast mode for other callers', async () => {
  const error = new OneKeyLocalError('synthetic isolated failure');
  const { run, attempted } = setup(error);
  await expect(run(false)).rejects.toBe(error);
  expect(attempted).toEqual(['evm--1', 'btc--0']);
});

it.each([
  new ThirdPartyAppNotInstalled(),
  new ThirdPartyInstallAppUserCancelled(),
])('preserves per-chain installation outcomes ($code)', async (error) => {
  const { run, attempted, saved } = setup(error);
  const result = await run();
  expect(attempted).toEqual(['evm--1', 'btc--0', 'sol--101']);
  expect(saved).toEqual(['evm--1', 'sol--101']);
  expect(result.failedAccounts).toEqual([
    expect.objectContaining({
      error: expect.objectContaining({ code: error.code }),
    }),
  ]);
  expect(
    classifyThirdPartyHwCreateFailures({
      addedCount: result.addedAccounts.length,
      failedAccounts: result.failedAccounts,
    }),
  ).toEqual({ allAppNotInstalled: false, genuineFailures: [] });
});

it('returns all missing apps so callers can offer Ledger app installation', async () => {
  const { run, attempted } = setup(new ThirdPartyAppNotInstalled(), true);
  const result = await run();
  expect(attempted).toEqual(['evm--1', 'btc--0', 'sol--101']);
  expect(result.failedAccounts).toHaveLength(3);
  expect(
    classifyThirdPartyHwCreateFailures({
      addedCount: result.addedAccounts.length,
      failedAccounts: result.failedAccounts,
    }),
  ).toEqual({ allAppNotInstalled: true, genuineFailures: [] });
});

it('does not repeat authentication after a masked authorization failure', async () => {
  const error = new OneKeyLocalError('Unknown error');
  const { run, attempted } = setup(error);
  await expect(run()).rejects.toBe(error);
  expect(attempted).toEqual(['evm--1', 'btc--0']);
});
