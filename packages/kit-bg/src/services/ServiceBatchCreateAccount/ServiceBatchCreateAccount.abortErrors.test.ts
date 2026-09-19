import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core/errors';

import ServiceBatchCreateAccount from '@onekeyhq/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount';
import { HardwareAllNetworkGetAddressResponse } from '@onekeyhq/kit-bg/src/services/ServiceHardware/HardwareAllNetworkGetAddressResponse';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  ThirdPartyAppNotInstalled,
  ThirdPartyAppTooOld,
  ThirdPartyDeviceOutOfMemory,
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

const networkRequests = [
  { networkId: 'evm--1', hwSdkNetwork: 'evm', path: "m/44'/60'/0'/0/0" },
  { networkId: 'btc--0', hwSdkNetwork: 'btc', path: "m/86'/0'/0'" },
  { networkId: 'sol--101', hwSdkNetwork: 'sol', path: "m/44'/501'/0'/0'" },
] as const;

function setup(
  failure: unknown,
  failAllNetworks = false,
  options: {
    response?: HardwareAllNetworkGetAddressResponse;
    walletId?: string;
    liveFailure?: boolean;
  } = {},
) {
  const attempted: string[] = [];
  const saved: string[] = [];
  const recordImportBatchCreateTrace = jest.fn(
    async (_data: unknown) => undefined,
  );
  const requestDevice = jest.fn(async (networkId: string) => {
    if (failAllNetworks || networkId === 'btc--0') throw failure;
  });
  const service = new ServiceBatchCreateAccount({
    backgroundApi: {
      serviceAccount: {
        getWalletDeviceParams: async () => undefined,
        prepareHdOrHwAccounts: async ({
          networkId,
          hwAllNetworkPrepareAccountsResponse,
        }: {
          networkId: string;
          hwAllNetworkPrepareAccountsResponse?: HardwareAllNetworkGetAddressResponse;
        }) => {
          attempted.push(networkId);
          if (options.liveFailure && networkId === 'btc--0') {
            await requestDevice(networkId);
          }
          if (hwAllNetworkPrepareAccountsResponse) {
            const request = networkRequests.find(
              (item) => item.networkId === networkId,
            );
            if (!request)
              throw new OneKeyLocalError('Synthetic network missing');
            await hwAllNetworkPrepareAccountsResponse.getItem(request);
          } else {
            await requestDevice(networkId);
          }
          return {
            vault: {
              getNetworkInfo: async () => ({}),
              buildAccountAddressDetail: async () => ({
                address: 'synthetic address',
              }),
            },
            accounts: [
              {
                pathIndex: 0,
                address: 'synthetic address',
                __hwExtraInfo__: {},
              },
            ],
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
        recordImportBatchCreateTrace,
      },
    },
  });
  const prefetch = jest
    .spyOn(service, 'getHwAllNetworkPrepareAccountsResponse')
    .mockResolvedValue(options.response);
  jest.spyOn(service, 'updateAccountExistsInDb').mockResolvedValue(undefined);
  const run = (autoHandleExitError = true, saveToDb = true) =>
    service.startBatchCreateAccountsFlowForAllNetwork({
      walletId: options.walletId ?? 'hd-1',
      fromIndex: 0,
      toIndex: 0,
      excludedIndexes: {},
      saveToDb,
      includingDefaultNetworks: false,
      autoHandleExitError,
      applyRestoreSyncPolicy: true,
      customNetworks: [
        { networkId: 'evm--1', deriveType: 'default' },
        { networkId: 'btc--0', deriveType: 'BIP86' },
        { networkId: 'sol--101', deriveType: 'default' },
      ],
    });
  return {
    run,
    attempted,
    saved,
    service,
    requestDevice,
    prefetch,
    recordImportBatchCreateTrace,
  };
}

function buildHardwareResponse(
  code: number,
  { completed = true, failAllNetworks = false } = {},
) {
  const response = new HardwareAllNetworkGetAddressResponse();
  for (const request of networkRequests) {
    // Attach consumers before delivering a bundle containing rejected items.
    void response.getItem(request).catch(() => undefined);
  }
  response.onSdkResponse({
    items: networkRequests.map((request) => ({
      path: request.path,
      network: request.hwSdkNetwork,
      success: !failAllNetworks && request.networkId !== 'btc--0',
      payload: {
        code,
        errorCode: code,
        error: 'Synthetic hardware response',
        connectId: 'connect-id',
        deviceId: 'device-id',
        address: 'synthetic address',
      },
    })),
    completed,
  });
  return response;
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

describe.each([new ThirdPartyAppTooOld(), new ThirdPartyDeviceOutOfMemory()])(
  'completed hardware app failure ($code)',
  (error) => {
    it('saves later successful responses and records the failed network without another device request', async () => {
      const {
        run,
        attempted,
        saved,
        prefetch,
        requestDevice,
        recordImportBatchCreateTrace,
      } = setup(error, false, {
        walletId: 'hw-1',
        response: buildHardwareResponse(error.code),
      });
      const result = await run();
      expect(attempted).toEqual(['evm--1', 'btc--0', 'sol--101']);
      expect(saved).toEqual(['evm--1', 'sol--101']);
      expect(result.failedAccounts).toEqual([
        expect.objectContaining({
          networkId: 'btc--0',
          error: expect.objectContaining({ code: error.code }),
        }),
      ]);
      expect(prefetch).toHaveBeenCalledTimes(1);
      expect(requestDevice).not.toHaveBeenCalled();
      expect(recordImportBatchCreateTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'error',
          stage: 'batchBuildAccountsForNetwork',
          networkId: 'btc--0',
        }),
      );
    });

    it('returns every failed result without retrying when all apps fail', async () => {
      const { run, saved, requestDevice, prefetch } = setup(error, true, {
        walletId: 'hw-1',
        response: buildHardwareResponse(error.code, { failAllNetworks: true }),
      });
      const result = await run();
      expect(result.failedAccounts).toHaveLength(3);
      expect(result.addedAccounts).toHaveLength(0);
      expect(saved).toEqual([]);
      expect(prefetch).toHaveBeenCalledTimes(1);
      expect(requestDevice).not.toHaveBeenCalled();
    });

    it('still stops a live device failure with the same code even when a completed response exists', async () => {
      const { run, attempted, requestDevice } = setup(error, false, {
        walletId: 'hw-1',
        response: buildHardwareResponse(error.code),
        liveFailure: true,
      });
      await expect(run()).rejects.toBe(error);
      expect(attempted).toEqual(['evm--1', 'btc--0']);
      expect(requestDevice).toHaveBeenCalledTimes(1);
    });

    it('stops when there is no prefetched response', async () => {
      const { run, attempted } = setup(error, false, { walletId: 'hw-1' });
      await expect(run()).rejects.toBe(error);
      expect(attempted).toEqual(['evm--1', 'btc--0']);
    });

    it.each(['incomplete', 'fail-fast', 'preview', 'cancelled'] as const)(
      'preserves the %s guard even for a known item failure',
      async (mode) => {
        const { run, attempted, service } = setup(error, false, {
          walletId: 'hw-1',
          response: buildHardwareResponse(error.code, {
            completed: mode !== 'incomplete',
          }),
        });
        if (mode === 'cancelled') {
          const original = service.forceExitFlowWhenErrorMatched.bind(service);
          jest
            .spyOn(service, 'forceExitFlowWhenErrorMatched')
            .mockImplementation((params) => {
              service.isCreateFlowCancelled = true;
              return original(params);
            });
        }
        await expect(
          run(mode !== 'fail-fast', mode !== 'preview'),
        ).rejects.toBeDefined();
        expect(attempted).toEqual(['evm--1', 'btc--0']);
      },
    );
  },
);

it.each([
  ThirdPartyHwErrorCode.UserRejected,
  ThirdPartyHwErrorCode.UserAborted,
  ThirdPartyHwErrorCode.PinInvalid,
  ThirdPartyHwErrorCode.TransportNotAvailable,
  999_999,
])('still aborts a completed device failure (%s)', async (code) => {
  const { run, attempted, saved, requestDevice } = setup(undefined, false, {
    walletId: 'hw-1',
    response: buildHardwareResponse(code),
  });
  await expect(run()).rejects.toBeDefined();
  expect(attempted).toEqual(['evm--1', 'btc--0']);
  expect(saved).toEqual(['evm--1']);
  expect(requestDevice).not.toHaveBeenCalled();
});
