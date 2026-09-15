/*
yarn jest packages/kit-bg/src/services/ServiceSend.availability.test.ts

Pins how send attempts are counted as `send` availability flows: one flow per
signed transaction, its final status, and that the instrumentation never
changes what the public ServiceSend methods return or throw.
*/
/* cspell:ignore Infini */

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));

jest.mock('p-retry', () => ({
  __esModule: true,
  default: (fn: () => unknown) => fn(),
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    GasAccountSubmitRetryCleared: 'GasAccountSubmitRetryCleared',
    GasAccountSubmitRetryScheduled: 'GasAccountSubmitRetryScheduled',
  },
  appEventBus: { emit: jest.fn() },
}));

const mockFinish = jest.fn<void, [IAvailabilityFlowResult]>();
const mockStartAvailabilityFlow = jest.fn<
  IAvailabilityFlowHandle,
  [IAvailabilityFlow, { detail?: string; trackUnfinished?: boolean }?]
>();

// Only the aggregator is replaced; withAvailabilityFlow and the error
// classification in availabilityMetrics stay real.
jest.mock('@onekeyhq/shared/src/request/availabilityAggregator', () => ({
  ...jest.requireActual<
    typeof import('@onekeyhq/shared/src/request/availabilityAggregator')
  >('@onekeyhq/shared/src/request/availabilityAggregator'),
  recordAvailabilityOutcome: () => undefined,
  startAvailabilityFlow: (
    flow: IAvailabilityFlow,
    options?: { detail?: string; trackUnfinished?: boolean },
  ) => mockStartAvailabilityFlow(flow, options),
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
}));

// eslint-disable-next-line import-js/order, import/first
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
// eslint-disable-next-line import-js/order, import/first
import {
  PasswordPromptDialogCancel,
  UserCancel,
  UserCancelFromOutside,
} from '@onekeyhq/shared/src/errors';
// eslint-disable-next-line import-js/order, import/first
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
// eslint-disable-next-line import-js/order, import/first
import type {
  IAvailabilityFlow,
  IAvailabilityFlowHandle,
  IAvailabilityFlowResult,
} from '@onekeyhq/shared/src/request/availabilityAggregator';
// eslint-disable-next-line import-js/order, import/first
import type { IGasAccountUiState } from '@onekeyhq/shared/types/fee';
// eslint-disable-next-line import-js/order, import/first
import type { IPrimeInfiniBeforeBroadcastAction } from '@onekeyhq/shared/types/prime/primeTypes';
// eslint-disable-next-line import-js/order, import/first
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';
// eslint-disable-next-line import-js/order, import/first
import { vaultFactory } from '../vaults/factory';
// eslint-disable-next-line import-js/order, import/first
import ServiceSend from './ServiceSend';

const accountId = 'hd-1--0';
const networkId = 'evm--1';
const sendFlowStartOptions = { detail: networkId, trackUnfinished: true };
const decodedTx = {
  networkId,
  accountId,
  actions: [],
} as unknown as IDecodedTx;

function createUnsignedTx(uuid?: string): IUnsignedTxPro {
  // transfersInfo keeps every multi-tx entry in the batch result.
  return { encodedTx: {}, uuid, transfersInfo: [] } as IUnsignedTxPro;
}

function createSignedTx(overrides: Partial<ISignedTxPro> = {}): ISignedTxPro {
  return { encodedTx: {}, rawTx: '0xsigned', txid: '', ...overrides };
}

function createCodedError(message: string, code: number | string) {
  return Object.assign(new Error(message), { code });
}

function makeService() {
  const vault = {
    signTransaction: jest.fn(() => Promise.resolve(createSignedTx())),
    broadcastTransaction: jest.fn(() => Promise.resolve({ txid: '0xtxid' })),
    checkShouldRetryBroadcastTx: jest.fn(() => Promise.resolve(false)),
    refreshUnsignedTxBeforeBatchSign: jest.fn((tx: IUnsignedTxPro) =>
      Promise.resolve(tx),
    ),
  };
  (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue(vault);

  const backgroundApi = {
    serviceAccount: {
      getAccountAddressForApi: jest.fn(() => Promise.resolve('0xaccount')),
    },
    servicePassword: {
      promptPasswordVerifyByAccount: jest.fn(() =>
        Promise.resolve({ password: 'password', deviceParams: undefined }),
      ),
    },
    serviceHardwareUI: {
      withHardwareProcessing: jest.fn((callback: () => Promise<ISignedTxPro>) =>
        callback(),
      ),
    },
    serviceDevSetting: {
      getDevSetting: jest.fn(() => Promise.resolve({})),
    },
    serviceNetwork: {
      getVaultSettings: jest.fn(() =>
        Promise.resolve<{
          maxRetryBroadcastTxCount: number;
          minRetryBroadcastTxInterval: number;
          withoutBroadcastTxId?: boolean;
        }>({
          maxRetryBroadcastTxCount: 0,
          minRetryBroadcastTxInterval: 0,
        }),
      ),
    },
    serviceSignature: {
      addItemFromSendProcess: jest.fn(() => Promise.resolve()),
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: jest.fn(() => Promise.resolve()),
    },
  };
  const Ctor = ServiceSend as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceSend;
  const service = new Ctor({ backgroundApi });
  jest.spyOn(service, 'buildDecodedTx').mockResolvedValue(decodedTx);
  return { service, vault, backgroundApi };
}

function getFinishResults() {
  return mockFinish.mock.calls.map(([result]) => result);
}

describe('ServiceSend send availability flow', () => {
  beforeEach(() => {
    (appEventBus.emit as unknown as jest.Mock).mockReset();
    mockFinish.mockReset();
    mockStartAvailabilityFlow.mockReset();
    mockStartAvailabilityFlow.mockImplementation(() => ({
      finish: mockFinish,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('signAndSendTransaction', () => {
    test('counts a broadcast with a txid as one submitted flow', async () => {
      const { service, vault } = makeService();

      const result = await service.signAndSendTransaction({
        accountId,
        networkId,
        unsignedTx: createUnsignedTx(),
        signOnly: false,
      });

      expect(result).toEqual({ ...createSignedTx(), txid: '0xtxid' });
      expect(mockStartAvailabilityFlow).toHaveBeenCalledTimes(1);
      expect(mockStartAvailabilityFlow).toHaveBeenCalledWith(
        'send',
        sendFlowStartOptions,
      );
      expect(getFinishResults()).toEqual([{ status: 'submitted' }]);
      // Started before any work so a killed process counts as unfinished;
      // finished only after the broadcast settled.
      expect(
        mockStartAvailabilityFlow.mock.invocationCallOrder[0],
      ).toBeLessThan(vault.signTransaction.mock.invocationCallOrder[0]);
      expect(
        vault.broadcastTransaction.mock.invocationCallOrder[0],
      ).toBeLessThan(mockFinish.mock.invocationCallOrder[0]);
    });

    test('counts sign-only as signed even when signing produced a txid', async () => {
      const { service, vault } = makeService();
      const signedTx = createSignedTx({ txid: '0xprecomputed' });
      vault.signTransaction.mockResolvedValueOnce(signedTx);

      const result = await service.signAndSendTransaction({
        accountId,
        networkId,
        unsignedTx: createUnsignedTx(),
        signOnly: true,
      });

      expect(result).toBe(signedTx);
      expect(result.txid).toBe('0xprecomputed');
      expect(vault.broadcastTransaction).not.toHaveBeenCalled();
      expect(mockStartAvailabilityFlow).toHaveBeenCalledTimes(1);
      expect(mockStartAvailabilityFlow).toHaveBeenCalledWith(
        'send',
        sendFlowStartOptions,
      );
      expect(getFinishResults()).toEqual([{ status: 'signed' }]);
    });

    test('counts a broadcast accepted without a txid as signed', async () => {
      const { service, vault, backgroundApi } = makeService();
      const signedTx = createSignedTx();
      vault.signTransaction.mockResolvedValueOnce(signedTx);
      vault.broadcastTransaction.mockResolvedValueOnce({ txid: '' });
      backgroundApi.serviceNetwork.getVaultSettings.mockResolvedValueOnce({
        maxRetryBroadcastTxCount: 0,
        minRetryBroadcastTxInterval: 0,
        withoutBroadcastTxId: true,
      });

      const result = await service.signAndSendTransaction({
        accountId,
        networkId,
        unsignedTx: createUnsignedTx(),
        signOnly: false,
      });

      expect(result).toBe(signedTx);
      expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
      expect(mockStartAvailabilityFlow).toHaveBeenCalledTimes(1);
      expect(getFinishResults()).toEqual([{ status: 'signed' }]);
    });

    test.each([
      {
        label: 'a dismissed password prompt',
        error: new PasswordPromptDialogCancel(),
        errorCode: 'passwordpromptdialogcancel',
        stage: 'password' as const,
      },
      {
        label: 'a hardware user rejection',
        error: new UserCancel(),
        errorCode: '803',
        stage: 'hardware' as const,
      },
      {
        label: 'a hardware cancel from outside',
        error: new UserCancelFromOutside(),
        errorCode: '107',
        stage: 'hardware' as const,
      },
    ])(
      'counts $label as cancelled and rethrows the original error',
      async ({ error, errorCode, stage }) => {
        const { service, vault, backgroundApi } = makeService();
        if (stage === 'password') {
          backgroundApi.servicePassword.promptPasswordVerifyByAccount.mockRejectedValueOnce(
            error,
          );
        } else {
          backgroundApi.serviceHardwareUI.withHardwareProcessing.mockRejectedValueOnce(
            error,
          );
        }

        await expect(
          service.signAndSendTransaction({
            accountId,
            networkId,
            unsignedTx: createUnsignedTx(),
            signOnly: false,
          }),
        ).rejects.toBe(error);

        expect(vault.broadcastTransaction).not.toHaveBeenCalled();
        expect(mockStartAvailabilityFlow).toHaveBeenCalledTimes(1);
        expect(getFinishResults()).toEqual([
          { status: 'cancelled', errorCode, detail: networkId },
        ]);
      },
    );

    test('counts a Gas Account submit cancelled during retry as cancelled', async () => {
      const { service, vault } = makeService();
      const submitId = 'submit-id';
      const gasAccountUiState: IGasAccountUiState = {
        selectedPayer: 'gasAccount',
        gasAccountQuote: {
          quoteId: 'quote-id',
          maxFee: '1',
          expiresAt: '1970-01-01T00:00:01.000Z',
        },
      };
      vault.broadcastTransaction.mockRejectedValueOnce(
        Object.assign(new Error('admission overloaded'), {
          code: 90_212,
          retryAfterSec: 1,
        }),
      );
      // The user cancels as soon as the deep retry is scheduled.
      (appEventBus.emit as unknown as jest.Mock).mockImplementation(
        (name: string) => {
          if (name === EAppEventBusNames.GasAccountSubmitRetryScheduled) {
            void service.abortGasAccountSubmit(submitId);
          }
        },
      );

      await expect(
        service.signAndSendTransaction({
          accountId,
          networkId,
          unsignedTx: createUnsignedTx(),
          signOnly: false,
          gasAccountUiState,
          gasAccountSubmitId: submitId,
        }),
      ).rejects.toMatchObject({ name: 'GasAccountSubmitCancelledError' });

      expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
      expect(mockStartAvailabilityFlow).toHaveBeenCalledTimes(1);
      expect(getFinishResults()).toEqual([
        {
          status: 'cancelled',
          errorCode: 'gasaccountsubmitcancellederror',
          detail: networkId,
        },
      ]);
    });

    test.each([
      {
        label: 'a generic broadcast failure',
        error: createCodedError('rpc unavailable', 40_001),
        result: { status: 'failed', errorCode: '40001', detail: networkId },
      },
      {
        label: 'a broadcast timeout',
        error: createCodedError('timeout of 10000ms exceeded', 'ECONNABORTED'),
        result: {
          status: 'timeout',
          errorCode: 'econnaborted',
          detail: networkId,
        },
      },
    ])(
      'counts $label with its error code and rethrows it',
      async ({ error, result }) => {
        const { service, vault } = makeService();
        vault.broadcastTransaction.mockRejectedValueOnce(error);

        await expect(
          service.signAndSendTransaction({
            accountId,
            networkId,
            unsignedTx: createUnsignedTx(),
            signOnly: false,
          }),
        ).rejects.toBe(error);

        expect(mockStartAvailabilityFlow).toHaveBeenCalledTimes(1);
        expect(getFinishResults()).toEqual([result]);
      },
    );
  });

  describe('batchSignAndSendTransaction', () => {
    test('counts one submitted flow per transaction and keeps the batch result', async () => {
      const { service, vault, backgroundApi } = makeService();
      const firstSignedTx = createSignedTx({ rawTx: '0xsigned-1' });
      const secondSignedTx = createSignedTx({ rawTx: '0xsigned-2' });
      vault.signTransaction
        .mockResolvedValueOnce(firstSignedTx)
        .mockResolvedValueOnce(secondSignedTx);
      vault.broadcastTransaction
        .mockResolvedValueOnce({ txid: '0xtxid-1' })
        .mockResolvedValueOnce({ txid: '0xtxid-2' });

      const result = await service.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: [createUnsignedTx('tx-1'), createUnsignedTx('tx-2')],
        signOnly: false,
        transferPayload: undefined,
      });

      expect(result).toEqual([
        {
          signedTx: { ...firstSignedTx, txid: '0xtxid-1' },
          decodedTx,
          feeInfo: undefined,
          approveInfo: undefined,
        },
        {
          signedTx: { ...secondSignedTx, txid: '0xtxid-2' },
          decodedTx,
          feeInfo: undefined,
          approveInfo: undefined,
        },
      ]);
      expect(
        backgroundApi.serviceHistory.saveSendConfirmHistoryTxs,
      ).toHaveBeenCalledTimes(2);
      expect(mockStartAvailabilityFlow.mock.calls).toEqual([
        ['send', sendFlowStartOptions],
        ['send', sendFlowStartOptions],
      ]);
      expect(getFinishResults()).toEqual([
        { status: 'submitted' },
        { status: 'submitted' },
      ]);
      expect(mockFinish.mock.invocationCallOrder[0]).toBeLessThan(
        mockStartAvailabilityFlow.mock.invocationCallOrder[1],
      );
    });

    test('counts only the transactions attempted before a batch failure', async () => {
      const { service, vault } = makeService();
      const error = createCodedError('rpc unavailable', 40_001);
      vault.broadcastTransaction
        .mockResolvedValueOnce({ txid: '0xtxid-1' })
        .mockRejectedValueOnce(error);

      await expect(
        service.batchSignAndSendTransaction({
          accountId,
          networkId,
          unsignedTxs: [
            createUnsignedTx('tx-1'),
            createUnsignedTx('tx-2'),
            createUnsignedTx('tx-3'),
          ],
          signOnly: false,
          transferPayload: undefined,
        }),
      ).rejects.toBe(error);

      expect(mockStartAvailabilityFlow).toHaveBeenCalledTimes(2);
      expect(getFinishResults()).toEqual([
        { status: 'submitted' },
        { status: 'failed', errorCode: '40001', detail: networkId },
      ]);
    });

    test('counts one signed flow per transaction in a sign-only batch', async () => {
      const { service, vault, backgroundApi } = makeService();
      const signAndSendSpy = jest.spyOn(service, 'signAndSendTransaction');
      const firstSignedTx = createSignedTx({ rawTx: '0xsigned-1' });
      const secondSignedTx = createSignedTx({ rawTx: '0xsigned-2' });
      vault.signTransaction
        .mockResolvedValueOnce(firstSignedTx)
        .mockResolvedValueOnce(secondSignedTx);

      const result = await service.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: [createUnsignedTx('tx-1'), createUnsignedTx('tx-2')],
        signOnly: true,
        transferPayload: undefined,
      });

      expect(result).toHaveLength(2);
      expect(result[0].signedTx).toBe(firstSignedTx);
      expect(result[1].signedTx).toBe(secondSignedTx);
      expect(result[0]).toEqual({
        signedTx: firstSignedTx,
        decodedTx,
        feeInfo: undefined,
        approveInfo: undefined,
      });
      expect(signAndSendSpy).not.toHaveBeenCalled();
      expect(vault.broadcastTransaction).not.toHaveBeenCalled();
      expect(
        backgroundApi.serviceHistory.saveSendConfirmHistoryTxs,
      ).not.toHaveBeenCalled();
      expect(mockStartAvailabilityFlow.mock.calls).toEqual([
        ['send', sendFlowStartOptions],
        ['send', sendFlowStartOptions],
      ]);
      expect(getFinishResults()).toEqual([
        { status: 'signed' },
        { status: 'signed' },
      ]);
    });

    test('counts a cancelled sign-only batch transaction and rethrows', async () => {
      const { service, backgroundApi } = makeService();
      const error = new PasswordPromptDialogCancel();
      backgroundApi.servicePassword.promptPasswordVerifyByAccount.mockRejectedValueOnce(
        error,
      );

      await expect(
        service.batchSignAndSendTransaction({
          accountId,
          networkId,
          unsignedTxs: [createUnsignedTx('tx-1'), createUnsignedTx('tx-2')],
          signOnly: true,
          transferPayload: undefined,
        }),
      ).rejects.toBe(error);

      expect(mockStartAvailabilityFlow).toHaveBeenCalledTimes(1);
      expect(getFinishResults()).toEqual([
        {
          status: 'cancelled',
          errorCode: 'passwordpromptdialogcancel',
          detail: networkId,
        },
      ]);
    });

    test('counts a sign-only batch with a before-broadcast action once', async () => {
      const { service, vault } = makeService();
      const beforeBroadcastAction: IPrimeInfiniBeforeBroadcastAction = {
        type: 'primeInfiniPayment',
        paymentCacheKey: {
          bindingId: 'binding-1',
          paymentId: 'payment-1',
          networkId,
          contractAddress: '0xtoken',
          onekeyUserId: 'user-1',
          plan: 'monthly',
          payerAccountId: accountId,
          payerAddress: '0xaccount',
        },
      };

      await expect(
        service.batchSignAndSendTransaction({
          accountId,
          networkId,
          unsignedTxs: [createUnsignedTx('tx-1')],
          signOnly: true,
          transferPayload: undefined,
          beforeBroadcastAction,
        }),
      ).rejects.toThrow('Prime Infini payment requires a real broadcast');

      expect(vault.signTransaction).not.toHaveBeenCalled();
      expect(mockStartAvailabilityFlow).toHaveBeenCalledTimes(1);
      expect(getFinishResults()).toEqual([
        { status: 'failed', errorCode: 'onekeylocalerror', detail: networkId },
      ]);
    });
  });
});
