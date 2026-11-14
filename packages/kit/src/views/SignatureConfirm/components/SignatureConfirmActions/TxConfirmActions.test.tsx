/** @jest-environment jsdom */
/* cspell:ignore Infini */
import type { ReactNode } from 'react';

import { act, cleanup, render } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { createDepositTaskController } from '@onekeyhq/kit/src/views/Staking/earnDepositTask/controller';
import { runDirectDepositTask } from '@onekeyhq/kit/src/views/Staking/earnDepositTask/directDepositTask';
import { createDepositTask } from '@onekeyhq/kit/src/views/Staking/earnDepositTask/state';
import { waitForEarnTransactionConfirm } from '@onekeyhq/kit/src/views/Staking/earnDepositTask/transactionConfirm';
import type { IDepositTaskHandle } from '@onekeyhq/kit/src/views/Staking/earnDepositTask/types';
import {
  OneKeyLocalError,
  PasswordPromptDialogCancel,
} from '@onekeyhq/shared/src/errors';
import { UserCancel } from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IPrimeInfiniBeforeBroadcastAction } from '@onekeyhq/shared/types/prime/primeTypes';

import TxConfirmActions from './TxConfirmActions';

type IFooterActions = {
  onConfirm?: () => Promise<void>;
  onCancel: (close: () => void, closePageStack: () => void) => void;
  confirmButtonProps?: { disabled: boolean };
};

const mockFooterActions = jest.fn<null, [IFooterActions]>(() => null);
const mockBatchSend = jest.fn<Promise<unknown>, [unknown]>();
const mockAllowance = jest.fn<
  Promise<{ allowanceParsed: string }>,
  [unknown]
>();
const mockBroadcastFact = jest.fn<Promise<unknown>, [unknown]>();
const mockBroadcastFactByUuid = jest.fn<Promise<unknown>, [unknown]>(
  async () => ({ status: 'unknown' }),
);
const mockAfterSend = jest.fn<Promise<void>, [unknown]>();
const mockGetWallet = jest.fn<Promise<unknown>, [unknown]>();
const mockGetDevice = jest.fn<Promise<unknown>, [unknown]>();
let mockAfterSendEnabled = false;
let mockPayer = 'gasAccount';
let mockFeeOverflow = false;
let mockAcceptFeeOverflow = true;
const mockEventListeners = new Map<string, Set<(payload: unknown) => void>>();
const mockCurrentRoute = jest.fn(() => ({ name: 'Confirm' }));
const mockNavigation = { pop: jest.fn(), popStack: jest.fn() };
const mockDappApprove = { resolve: jest.fn(), reject: jest.fn() };
const mockUnsignedTxs = [
  {
    uuid: 'tx-uuid-1',
    encodedTx: { from: '0xpayer', to: '0xrecipient', value: '0x1' },
    nonce: 1,
  },
];
// Tx uuids latched after a result-unknown Gas Account send (OK-64746).
const mockLatchedTxUuids = new Set<string>();
const mockActions = {
  updateEffectiveFeePayer: jest.fn(),
  updateGasAccountTemporarilyDisabled: jest.fn(),
  resetGasAccountTemporarilyDisabled: jest.fn(),
  markGasAccountSubmitResultUnknown: jest.fn(),
  updateGasAccountUiState: jest.fn(),
  resetGasAccountUiState: jest.fn(),
  updateSendFeeStatus: jest.fn(),
  updateSendTxStatus: jest.fn(),
  updateTxFeeInfoInit: jest.fn(),
  updateUnsignedTxs: jest.fn(),
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: { current: { getCurrentRoute: () => mockCurrentRoute() } },
  Page: {
    Footer: ({ children }: { children: ReactNode }) => children,
    FooterActions: (props: IFooterActions) => mockFooterActions(props),
  },
  Checkbox: () => null,
  Stack: ({ children }: { children: ReactNode }) => children,
  Toast: {
    warning: jest.fn(),
    success: jest.fn(),
    message: jest.fn(),
    error: jest.fn(),
  },
  useSafeAreaInsets: () => ({ bottom: 0 }),
  usePageUnMounted: (onUnmount: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const latest = React.useRef(onUnmount);
    latest.current = onUnmount;
    React.useEffect(
      () => () => {
        // Page invokes this after the navigation transition, not during pop.
        setTimeout(() => latest.current(), 1000);
      },
      [],
    );
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: jest.fn(async () => '0xpayer'),
      getAccount: jest.fn(async () => ({ address: '0xpayer' })),
      getWallet: (params: unknown) => mockGetWallet(params),
      getAccountDeviceSafe: (params: unknown) => mockGetDevice(params),
    },
    serviceStaking: {
      fetchTokenAllowance: (params: unknown) => mockAllowance(params),
    },
    serviceSignatureConfirm: {
      preActionsBeforeSending: jest.fn(async () => undefined),
      afterSendTxAction: (params: unknown) => mockAfterSend(params),
    },
    serviceSend: {
      releaseUnsignedTxs: jest.fn(async () => undefined),
      precheckUnsignedTxs: jest.fn(async () => undefined),
      updateUnSignedTxBeforeSending: jest.fn(async () => mockUnsignedTxs),
      batchSignAndSendTransaction: (params: unknown) => mockBatchSend(params),
      getBroadcastAcceptanceFact: (params: unknown) =>
        mockBroadcastFact(params),
      getBroadcastAcceptanceFactByUuid: (params: unknown) =>
        mockBroadcastFactByUuid(params),
      abortGasAccountSubmit: jest.fn(async () => undefined),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/hooks/useDappApproveAction', () => ({
  __esModule: true,
  default: () => mockDappApprove,
}));
jest.mock('@onekeyhq/kit/src/hooks/useInterval', () => ({
  useInterval: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: {
      nonceRequired: false,
      replaceTxEnabled: false,
      afterSendTxActionEnabled: mockAfterSendEnabled,
    },
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useScopedAcknowledgement', () => ({
  useScopedAcknowledgement: () => ({
    isAccepted: true,
    setAccepted: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useShouldRejectDappAction', () => ({
  __esModule: true,
  default: () => ({ shouldRejectDappAction: () => false }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm', () => ({
  useSendSelectedFeeInfoAtom: () => [{ feeInfos: [] }],
  useSendFeeStatusAtom: () => [{}],
  useSendTxStatusAtom: () => [{ isSubmitting: false }],
  useEffectiveFeePayerAtom: () => ['gasAccount'],
  useGasAccountUiStateAtom: () => [
    { selectedPayer: mockPayer, gasAccountQuote: { quoteId: 'quote-1' } },
  ],
  useIsGasAccountSubmitResultUnknown: (txUuid?: string) =>
    mockLatchedTxUuids.has(txUuid ?? ''),
  useMegafuelEligibleAtom: () => [{}],
  useUnsignedTxsAtom: () => [mockUnsignedTxs],
  useNativeTokenInfoAtom: () => [{ isLoading: false }],
  useNativeTokenTransferAmountToUpdateAtom: () => [{}],
  usePreCheckTxStatusAtom: () => [{}],
  useTxAdvancedSettingsAtom: () => [{}],
  useDecodedTxsAtom: () => [{ isBuildingDecodedTxs: false, decodedTxs: [] }],
  useSignatureConfirmActions: () => ({ current: mockActions }),
  useTronResourceRentalInfoAtom: () => [undefined],
  useTxFeeInfoInitAtom: () => [true],
  useDecodedTxsInitAtom: () => [true],
  useCustomRpcStatusAtom: () => [undefined],
}));
jest.mock('../../hooks/useGasAccountAnalyticsContext', () => ({
  useGasAccountAnalyticsContext: () => undefined,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd' } }],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { BatchSendTxBroadcasted: 'BatchSendTxBroadcasted' },
  appEventBus: {
    on: jest.fn((name: string, handler: (payload: unknown) => void) => {
      if (!mockEventListeners.has(name))
        mockEventListeners.set(name, new Set());
      mockEventListeners.get(name)?.add(handler);
    }),
    off: jest.fn((name: string, handler: (payload: unknown) => void) =>
      mockEventListeners.get(name)?.delete(handler),
    ),
    emit: jest.fn((name: string, payload: unknown) =>
      mockEventListeners.get(name)?.forEach((handler) => handler(payload)),
    ),
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    transaction: {
      send: {
        gasAccountAction: jest.fn(),
        gasAccountDecision: jest.fn(),
        sendConfirm: jest.fn(),
      },
    },
  },
}));
jest.mock('../../hooks/usePreCheckFeeInfo', () => ({
  usePreCheckFeeInfo: () => ({
    checkFeeInfoIsOverflow: jest.fn(async () => mockFeeOverflow),
    showFeeInfoOverflowConfirm: jest.fn(async () => mockAcceptFeeOverflow),
  }),
}));
jest.mock('../CustomHexDataAlert', () => ({
  showCustomHexDataAlert: jest.fn(),
}));
jest.mock('../TxFee', () => ({ __esModule: true, default: () => null }));

const beforeBroadcastAction: IPrimeInfiniBeforeBroadcastAction = {
  type: 'primeInfiniPayment',
  paymentCacheKey: {
    bindingId: 'binding-1',
    paymentId: 'payment-1',
    networkId: 'evm--1',
    contractAddress: '',
    onekeyUserId: 'user-1',
    plan: 'monthly',
    payerAccountId: 'hd-1--0',
    payerAddress: '0xpayer',
  },
};

function getFooterActions() {
  return mockFooterActions.mock.calls[
    mockFooterActions.mock.calls.length - 1
  ][0];
}

describe('TxConfirmActions Gas Account failure exit', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockPayer = 'gasAccount';
    mockFeeOverflow = false;
    mockAcceptFeeOverflow = true;
  });
  afterEach(() => {
    cleanup();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it.each([
    { code: 40_202, popStack: true },
    { code: 40_202, popStack: false },
    { code: 40_213, popStack: true },
    { code: 40_213, popStack: false },
    { code: 50_000, popStack: true },
    { code: 50_000, popStack: false },
  ])(
    'reports Infini failure once after error $code and popStack=$popStack',
    async ({ code, popStack }) => {
      const error = Object.assign(new Error('Gas Account failed'), { code });
      mockBatchSend.mockRejectedValue(error);
      const onFail = jest.fn();
      const onCancel = jest.fn();
      const screen = render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          beforeBroadcastAction={beforeBroadcastAction}
          popStack={popStack}
          onFail={onFail}
          onCancel={onCancel}
        />,
      );
      expect(getFooterActions().confirmButtonProps?.disabled).toBe(false);
      await act(async () => {
        await getFooterActions().onConfirm?.();
      });
      expect(onFail).toHaveBeenCalledTimes(1);
      expect(onFail).toHaveBeenCalledWith(error);
      expect(
        popStack ? mockNavigation.popStack : mockNavigation.pop,
      ).toHaveBeenCalledTimes(1);
      screen.unmount();
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onCancel).not.toHaveBeenCalled();
      expect(onFail).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['address', 'precheck', 'preActions', 'update'] as const)(
    'exits once after %s failure and ignores late cancellation',
    async (phase) => {
      const stages = {
        address: jest.spyOn(
          backgroundApiProxy.serviceAccount,
          'getAccountAddressForApi',
        ),
        precheck: jest.spyOn(
          backgroundApiProxy.serviceSend,
          'precheckUnsignedTxs',
        ),
        preActions: jest.spyOn(
          backgroundApiProxy.serviceSignatureConfirm,
          'preActionsBeforeSending',
        ),
        update: jest.spyOn(
          backgroundApiProxy.serviceSend,
          'updateUnSignedTxBeforeSending',
        ),
      };
      const error = new Error('Preparation failed');
      jest.mocked(stages[phase]).mockRejectedValueOnce(error);
      const onFail = jest.fn();
      const onCancel = jest.fn();
      const screen = render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          beforeBroadcastAction={beforeBroadcastAction}
          onFail={onFail}
          onCancel={onCancel}
        />,
      );
      await act(async () => {
        await getFooterActions().onConfirm?.();
      });
      expect(onFail).toHaveBeenCalledWith(error);
      expect(onFail).toHaveBeenCalledTimes(1);
      expect(mockBatchSend).not.toHaveBeenCalled();
      expect(mockNavigation.popStack).toHaveBeenCalledTimes(1);
      screen.unmount();
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onCancel).not.toHaveBeenCalled();
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'stops a cancelled precheck after late %s',
    async (outcome) => {
      let resolve: () => void = () => undefined;
      let reject: (error: Error) => void = () => undefined;
      jest
        .mocked(
          jest.spyOn(backgroundApiProxy.serviceSend, 'precheckUnsignedTxs'),
        )
        .mockImplementationOnce(
          () =>
            new Promise<void>((res, rej) => {
              resolve = res;
              reject = rej;
            }),
        );
      const onFail = jest.fn();
      const onCancel = jest.fn();
      render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          beforeBroadcastAction={beforeBroadcastAction}
          onFail={onFail}
          onCancel={onCancel}
        />,
      );
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = getFooterActions().onConfirm?.();
      });
      getFooterActions().onCancel(jest.fn(), jest.fn());
      await act(async () => {
        if (outcome === 'resolve') resolve();
        else reject(new Error('Late failure'));
        await pending;
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onFail).not.toHaveBeenCalled();
      expect(mockBatchSend).not.toHaveBeenCalled();
      expect(mockNavigation.pop).not.toHaveBeenCalled();
    },
  );

  it.each([
    { mode: 'ordinary', outcome: 'resolve' },
    { mode: 'ordinary', outcome: 'reject' },
    { mode: 'infini', outcome: 'resolve' },
    { mode: 'infini', outcome: 'reject' },
  ] as const)(
    'ignores a late before-send $outcome after cancelling an $mode attempt',
    async ({ mode, outcome }) => {
      let resolve: () => void = () => undefined;
      let reject: (error: Error) => void = () => undefined;
      const onBeforeSend = jest.fn(
        () =>
          new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
          }),
      );
      const onFail = jest.fn();
      const onCancel = jest.fn();
      const onSuccess = jest.fn();
      render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          beforeBroadcastAction={
            mode === 'infini' ? beforeBroadcastAction : undefined
          }
          onBeforeSend={onBeforeSend}
          onFail={onFail}
          onCancel={onCancel}
          onSuccess={onSuccess}
        />,
      );
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = getFooterActions().onConfirm?.();
      });
      expect(onBeforeSend).toHaveBeenCalledTimes(1);
      await act(async () => {
        getFooterActions().onCancel(jest.fn(), jest.fn());
        if (outcome === 'resolve') resolve();
        else reject(new Error('Late before-send failure'));
        await pending;
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onFail).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(mockDappApprove.reject).toHaveBeenCalledTimes(1);
      expect(mockBatchSend).not.toHaveBeenCalled();
      expect(mockNavigation.pop).not.toHaveBeenCalled();
      expect(mockNavigation.popStack).not.toHaveBeenCalled();
    },
  );

  it('reports a precheck failure separately from an uncertain send failure', async () => {
    const error = new Error('precheck unavailable');
    jest
      .spyOn(backgroundApiProxy.serviceSend, 'precheckUnsignedTxs')
      .mockRejectedValueOnce(error);
    const onFail = jest.fn();
    const onSafePreSendFail = jest.fn();
    render(
      <TxConfirmActions
        accountId="hd-1--0"
        networkId="evm--1"
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onFail={onFail}
        onSafePreSendFail={onSafePreSendFail}
      />,
    );
    await act(async () => {
      await expect(getFooterActions().onConfirm?.()).rejects.toThrow(error);
    });
    expect(onSafePreSendFail).toHaveBeenCalledWith(error);
    expect(onFail).not.toHaveBeenCalled();
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it.each([new PasswordPromptDialogCancel(), new UserCancel()])(
    'releases an Earn send after a local signing cancellation: %s',
    async (error) => {
      mockPayer = 'native';
      mockBatchSend.mockRejectedValueOnce(error);
      const blocked = jest.fn();
      const uncertain = jest.fn();
      const operation = waitForEarnTransactionConfirm({
        navigationToTxConfirm: async (params) => {
          render(
            <TxConfirmActions
              accountId="hd-1--0"
              networkId="evm--1"
              securityCheckConfirmation="none"
              securityCheckAcknowledgementKey="tx-1"
              onBeforeSend={params.onBeforeSend}
              onSafePreSendFail={params.onSafePreSendFail}
              onFail={params.onFail}
              onCancel={params.onCancel}
              onSuccess={params.onSuccess}
            />,
          );
        },
        expiredMessage: 'expired',
        onSendBlocked: blocked,
        onUncertainFailure: uncertain,
      });
      const outcome = operation.catch((failure: unknown) => failure);
      await act(async () => {
        await expect(getFooterActions().onConfirm?.()).rejects.toBe(error);
      });
      await expect(outcome).resolves.toBe(error);
      expect(blocked).toHaveBeenCalledTimes(1);
      expect(uncertain).not.toHaveBeenCalled();
    },
  );

  it.each(['batch', 'pre-send', 'external', 'unknown'] as const)(
    'keeps %s failures on the uncertain failure path',
    async (scenario) => {
      mockPayer = 'native';
      const error =
        scenario === 'unknown' ? new Error('RPC timeout') : new UserCancel();
      mockBatchSend.mockRejectedValueOnce(error);
      if (scenario === 'batch')
        jest
          .spyOn(
            backgroundApiProxy.serviceSend,
            'updateUnSignedTxBeforeSending',
          )
          .mockResolvedValueOnce([
            ...mockUnsignedTxs,
            { ...mockUnsignedTxs[0], uuid: 'tx-2' },
          ]);
      if (scenario === 'pre-send')
        jest
          .spyOn(
            backgroundApiProxy.serviceSignatureConfirm,
            'preActionsBeforeSending',
          )
          .mockResolvedValueOnce({ preSendTx: { txid: 'pre-send-tx' } });
      const onFail = jest.fn();
      const onSafePreSendFail = jest.fn();
      render(
        <TxConfirmActions
          accountId={
            scenario === 'external' ? 'external--wallet--0' : 'hd-1--0'
          }
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          onFail={onFail}
          onSafePreSendFail={onSafePreSendFail}
        />,
      );
      await act(async () => {
        await expect(getFooterActions().onConfirm?.()).rejects.toBe(error);
      });
      expect(onFail).toHaveBeenCalledWith(error);
      expect(onSafePreSendFail).not.toHaveBeenCalled();
    },
  );

  it('retries an Earn confirmation after a safe precheck failure and submits once', async () => {
    mockGetWallet.mockResolvedValue(undefined);
    mockGetDevice.mockResolvedValue(undefined);
    jest
      .spyOn(backgroundApiProxy.serviceSend, 'precheckUnsignedTxs')
      .mockRejectedValueOnce(new Error('precheck unavailable'));
    mockBatchSend.mockResolvedValueOnce([
      {
        signedTx: { uuid: 'tx-uuid-1', txid: 'txid-1' },
        decodedTx: { actions: [] },
      },
    ]);
    const submitted = jest.fn();
    const uncertain = jest.fn();
    const operation = waitForEarnTransactionConfirm({
      navigationToTxConfirm: async (params) => {
        render(
          <TxConfirmActions
            accountId="hd-1--0"
            networkId="evm--1"
            securityCheckConfirmation="none"
            securityCheckAcknowledgementKey="tx-1"
            onBeforeSend={params.onBeforeSend}
            onSafePreSendFail={params.onSafePreSendFail}
            onFail={params.onFail}
            onCancel={params.onCancel}
            onSuccess={params.onSuccess}
          />,
        );
      },
      expiredMessage: 'expired',
      onSubmitted: submitted,
      onUncertainFailure: uncertain,
    });
    await act(async () => {
      await expect(getFooterActions().onConfirm?.()).rejects.toThrow(
        'precheck unavailable',
      );
    });
    expect(mockBatchSend).not.toHaveBeenCalled();
    await act(async () => {
      await getFooterActions().onConfirm?.();
    });
    await expect(operation).resolves.toEqual(
      expect.objectContaining({ status: 'success' }),
    );
    expect(mockBatchSend).toHaveBeenCalledTimes(1);
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(uncertain).not.toHaveBeenCalled();
  });

  it.each(['preaction-fails', 'update-fails', 'guard-fails'] as const)(
    'does not repeat an Earn pre-action after its outcome may be recorded: %s',
    async (stage) => {
      const preActions = jest.spyOn(
        backgroundApiProxy.serviceSignatureConfirm,
        'preActionsBeforeSending',
      );
      if (stage === 'preaction-fails')
        preActions.mockRejectedValueOnce(new Error('preaction failed'));
      else preActions.mockResolvedValueOnce({ preSendTx: { txid: '' } });
      if (stage === 'update-fails')
        jest
          .spyOn(
            backgroundApiProxy.serviceSend,
            'updateUnSignedTxBeforeSending',
          )
          .mockRejectedValueOnce(new Error('update failed'));
      const onFail = jest.fn();
      const onSafePreSendFail = jest.fn();
      render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          onBeforeSend={
            stage === 'guard-fails'
              ? async () => {
                  throw new OneKeyLocalError('guard failed');
                }
              : undefined
          }
          onFail={onFail}
          onSafePreSendFail={onSafePreSendFail}
        />,
      );
      await act(async () => {
        await expect(getFooterActions().onConfirm?.()).rejects.toThrow();
      });
      expect(onFail).toHaveBeenCalledTimes(1);
      expect(onSafePreSendFail).not.toHaveBeenCalled();
      await act(async () => {
        await expect(getFooterActions().onConfirm?.()).rejects.toThrow(
          'cannot be retried',
        );
      });
      expect(preActions).toHaveBeenCalledTimes(1);
      expect(mockBatchSend).not.toHaveBeenCalled();
    },
  );

  it('does not repeat an Earn pre-action after declining a high fee', async () => {
    mockPayer = 'native';
    mockFeeOverflow = true;
    mockAcceptFeeOverflow = false;
    const preActions = jest
      .spyOn(
        backgroundApiProxy.serviceSignatureConfirm,
        'preActionsBeforeSending',
      )
      .mockResolvedValueOnce({ preSendTx: { txid: '' } });
    const onFail = jest.fn();
    render(
      <TxConfirmActions
        accountId="hd-1--0"
        networkId="evm--1"
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onFail={onFail}
        onSafePreSendFail={jest.fn()}
      />,
    );
    await act(async () => {
      await getFooterActions().onConfirm?.();
    });
    await act(async () => {
      await expect(getFooterActions().onConfirm?.()).rejects.toThrow(
        'cannot be retried',
      );
    });
    expect(preActions).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it('reports an active before-send failure once without sending', async () => {
    const error = new Error('before-send failure');
    const onFail = jest.fn();
    render(
      <TxConfirmActions
        accountId="hd-1--0"
        networkId="evm--1"
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onBeforeSend={async () => {
          throw error;
        }}
        onFail={onFail}
      />,
    );
    await act(async () => {
      await expect(getFooterActions().onConfirm?.()).rejects.toThrow(error);
    });
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith(error);
    expect(mockDappApprove.reject).toHaveBeenCalledTimes(1);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });

  it.each([
    { legacyScanner: false, userCancelled: false },
    { legacyScanner: false, userCancelled: true },
    { legacyScanner: true, userCancelled: false },
  ])(
    'continues QR rental after delayed rebuild, legacy=$legacyScanner cancelled=$userCancelled',
    async ({ legacyScanner, userCancelled }) => {
      mockCurrentRoute.mockReturnValue({
        name: legacyScanner ? 'ScanQrCodeStack' : 'Confirm',
      });
      jest
        .spyOn(
          backgroundApiProxy.serviceSignatureConfirm,
          'preActionsBeforeSending',
        )
        .mockResolvedValueOnce({ preSendTx: { txid: 'rental' } });
      let resolveRebuild: (value: typeof mockUnsignedTxs) => void = () =>
        undefined;
      jest
        .spyOn(backgroundApiProxy.serviceSend, 'updateUnSignedTxBeforeSending')
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveRebuild = resolve;
            }),
        );
      mockBatchSend.mockRejectedValue(
        new Error('Stop after main signing starts'),
      );
      const onCancel = jest.fn();
      const screen = render(
        <TxConfirmActions
          accountId="qr-1--0"
          networkId="tron--0x2b6653dc"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          onCancel={onCancel}
        />,
      );
      // Reproduce the old internal pop unmounting the underlying confirmation.
      mockNavigation.popStack.mockImplementationOnce(() => {
        if (legacyScanner)
          mockCurrentRoute.mockReturnValue({ name: 'Confirm' });
        else screen.unmount();
      });
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = getFooterActions().onConfirm?.();
      });
      expect(mockNavigation.popStack).toHaveBeenCalledTimes(
        legacyScanner ? 1 : 0,
      );
      if (userCancelled) screen.unmount();
      act(() => {
        jest.advanceTimersByTime(1500);
      });
      await act(async () => {
        resolveRebuild(mockUnsignedTxs);
        await pending?.catch(() => undefined);
      });
      expect(mockBatchSend).toHaveBeenCalledTimes(userCancelled ? 0 : 1);
      expect(onCancel).toHaveBeenCalledTimes(userCancelled ? 1 : 0);
      mockNavigation.popStack.mockReset();
    },
  );

  it.each([40_202, 40_213])(
    'keeps ordinary sends retryable and cancellable after error %s',
    async (code) => {
      mockBatchSend.mockRejectedValue(
        Object.assign(new Error('Gas Account failed'), { code }),
      );
      const onFail = jest.fn();
      const onCancel = jest.fn();
      const screen = render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          onFail={onFail}
          onCancel={onCancel}
        />,
      );
      await act(async () => {
        await getFooterActions().onConfirm?.();
      });
      await act(async () => {
        await getFooterActions().onConfirm?.();
      });
      expect(mockBatchSend).toHaveBeenCalledTimes(2);
      expect(onFail).not.toHaveBeenCalled();
      expect(mockNavigation.pop).not.toHaveBeenCalled();
      expect(mockNavigation.popStack).not.toHaveBeenCalled();
      getFooterActions().onCancel(jest.fn(), jest.fn());
      screen.unmount();
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { code: 40_202, retry: 'valid' },
    { code: 40_213, retry: 'valid' },
    { code: 40_202, retry: 'account' },
    { code: 40_213, retry: 'allowance' },
    { code: 40_213, retry: 'approve-allowance' },
  ] as const)(
    'rechecks the direct legacy reset before manual retry after Gas Account error $code: $retry',
    async ({ code, retry }) => {
      mockBatchSend.mockReset();
      const ownerAddressSpy = jest.spyOn(
        backgroundApiProxy.serviceAccount,
        'getAccountAddressForApi',
      );
      ownerAddressSpy.mockReset().mockResolvedValue('0xpayer');
      let rejectSend: (error: Error) => void = () => undefined;
      mockBatchSend.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectSend = reject;
          }),
      );
      mockBatchSend.mockRejectedValueOnce(
        Object.assign(new Error('Gas Account failed'), { code }),
      );
      mockAllowance.mockResolvedValue({
        allowanceParsed: retry === 'approve-allowance' ? '0' : '4',
      });
      let handle: IDepositTaskHandle | undefined;
      let operation: Promise<boolean> | undefined;
      await act(async () => {
        operation = runDirectDepositTask({
          identity: {
            accountId: 'hd-1--0',
            accountAddress: '0xpayer',
            networkId: 'evm--1',
            provider: 'aave',
            vault: 'vault',
            inputTokenAddress: 'token',
            depositTokenAddress: 'token',
            amount: '10',
            spenderAddress: 'spender',
          },
          token: {
            address: 'token',
            name: 'Token',
            symbol: 'TOKEN',
            decimals: 6,
            isNative: false,
          },
          requiresAllowanceReset: retry !== 'approve-allowance',
          allowanceVerificationMode: 'legacy',
          signal: new AbortController().signal,
          isCurrent: () => true,
          confirmReset: async () => true,
          prepareDeposit: async () => ({ type: 'cancelled' }),
          confirm: (params) =>
            waitForEarnTransactionConfirm({
              ...params,
              navigationToTxConfirm: async (options) => {
                render(
                  <TxConfirmActions
                    accountId="hd-1--0"
                    networkId="evm--1"
                    securityCheckConfirmation="none"
                    securityCheckAcknowledgementKey="tx-1"
                    onBeforeSend={options.onBeforeSend}
                    onFail={options.onFail}
                    onCancel={options.onCancel}
                    onSuccess={options.onSuccess}
                  />,
                );
              },
              expiredMessage: 'expired',
            }),
          onTaskReady: (value) => {
            handle = value;
          },
          onDepositSuccess: async () => undefined,
          formatMessage: (id) => id,
        });
      });
      let first: Promise<void> | undefined;
      await act(async () => {
        first = getFooterActions().onConfirm?.();
      });
      await act(async () => {
        await getFooterActions().onConfirm?.();
      });
      expect(mockBatchSend).toHaveBeenCalledTimes(1);
      await act(async () => {
        rejectSend(Object.assign(new Error('Gas Account failed'), { code }));
        await first;
      });
      expect(handle?.getTask().steps[0].status.type).toBe('sending');
      const callsBeforeRetry = mockAllowance.mock.calls.length;
      if (retry === 'account')
        ownerAddressSpy
          .mockResolvedValueOnce('0xother')
          .mockResolvedValueOnce('0xother');
      if (retry === 'allowance')
        mockAllowance.mockResolvedValue({ allowanceParsed: '0' });
      if (retry === 'approve-allowance')
        mockAllowance.mockResolvedValue({ allowanceParsed: '10' });
      if (retry === 'valid') {
        await act(async () => {
          await getFooterActions().onConfirm?.();
        });
        expect(mockBatchSend).toHaveBeenCalledTimes(2);
        expect(mockAllowance.mock.calls.length).toBeGreaterThan(
          callsBeforeRetry,
        );
        expect(handle?.getTask().steps[0].status.type).toBe('sending');
        await act(async () => {
          getFooterActions().onCancel(jest.fn(), jest.fn());
          await operation;
        });
      } else {
        await act(async () => {
          await expect(getFooterActions().onConfirm?.()).rejects.toThrow();
          await expect(operation).rejects.toThrow();
        });
        expect(mockBatchSend).toHaveBeenCalledTimes(1);
      }
      expect(handle?.getTask().steps[0].status.type).toBe('unknown');
      ownerAddressSpy.mockReset().mockResolvedValue('0xpayer');
      mockBatchSend.mockReset();
    },
  );

  it.each([
    { code: 40_202, exit: 'cancel' },
    { code: 40_213, exit: 'cancel' },
    { code: 40_202, exit: 'scope-change' },
    { code: 40_213, exit: 'scope-change' },
  ])(
    'keeps a Native task uncertain after Gas Account error $code and $exit',
    async ({ code, exit }) => {
      let rejectSend: (error: Error) => void = () => undefined;
      mockBatchSend.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectSend = reject;
          }),
      );
      mockBatchSend.mockRejectedValueOnce(
        Object.assign(new Error('Gas Account failed'), { code }),
      );
      let ownerCurrent = true;
      const guard = jest.fn(async () => {
        if (!ownerCurrent) throw new OneKeyLocalError('expired');
      });
      const task = createDepositTask({
        taskId: 'native-task',
        identity: {
          accountId: 'account',
          accountAddress: 'owner',
          networkId: 'evm--1',
          provider: 'native',
          vault: 'vault',
          inputTokenAddress: 'native',
          depositTokenAddress: 'wrapped',
          amount: '1',
          spenderAddress: 'spender',
        },
        steps: [
          { id: 'wrap', kind: 'wrap' },
          { id: 'approve', kind: 'approve' },
          { id: 'deposit', kind: 'deposit' },
        ],
      });
      const taskController = createDepositTaskController({
        task,
        isCurrent: () => true,
        onChange: () => undefined,
        adapter: {
          prepare: async () => ({ type: 'confirm', prepared: undefined }),
          confirm: async ({ signal, onBeforeSend, onSendBlocked }) => {
            const result = await waitForEarnTransactionConfirm({
              navigationToTxConfirm: async (params) => {
                render(
                  <TxConfirmActions
                    accountId="hd-1--0"
                    networkId="evm--1"
                    securityCheckConfirmation="none"
                    securityCheckAcknowledgementKey="tx-1"
                    onBeforeSend={params.onBeforeSend}
                    onFail={params.onFail}
                    onCancel={params.onCancel}
                    onSuccess={params.onSuccess}
                  />,
                );
              },
              expiredMessage: 'expired',
              signal,
              allowManualResubmission: true,
              beforeSendGuard: guard,
              onSendStarted: onBeforeSend,
              onSendBlocked,
            });
            return {
              type: result.status === 'cancel' ? 'cancelled' : 'submitted',
            };
          },
          waitForFinalStatus: async () => 'unknown',
          verify: async () => false,
        },
      });
      let operation: Promise<void> | undefined;
      await act(async () => {
        operation = taskController.run();
      });
      let first: Promise<void> | undefined;
      await act(async () => {
        first = getFooterActions().onConfirm?.();
      });
      await act(async () => {
        await getFooterActions().onConfirm?.();
      });
      expect(mockBatchSend).toHaveBeenCalledTimes(1);
      expect(guard).toHaveBeenCalledTimes(1);
      await act(async () => {
        rejectSend(Object.assign(new Error('Gas Account failed'), { code }));
        await first;
      });
      expect(taskController.getTask().steps[0].status.type).toBe('sending');
      await act(async () => {
        await getFooterActions().onConfirm?.();
      });
      expect(mockBatchSend).toHaveBeenCalledTimes(2);
      expect(guard).toHaveBeenCalledTimes(2);
      expect(taskController.getTask().steps[0].status.type).toBe('sending');
      if (exit === 'scope-change') {
        ownerCurrent = false;
        await act(async () => {
          await expect(getFooterActions().onConfirm?.()).rejects.toThrow(
            'expired',
          );
          await operation;
        });
        expect(guard).toHaveBeenCalledTimes(3);
        expect(mockBatchSend).toHaveBeenCalledTimes(2);
      } else {
        await act(async () => {
          getFooterActions().onCancel(jest.fn(), jest.fn());
          await operation;
        });
      }
      expect(taskController.getTask().steps[0].status.type).toBe('unknown');
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'ignores a late %s after cancellation and blocks concurrent confirmation',
    async (outcome) => {
      let resolveSend: (value: unknown) => void = () => undefined;
      let rejectSend: (error: Error) => void = () => undefined;
      mockBatchSend.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            resolveSend = resolve;
            rejectSend = reject;
          }),
      );
      const onFail = jest.fn();
      const onCancel = jest.fn();
      const onSuccess = jest.fn();
      const screen = render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          beforeBroadcastAction={beforeBroadcastAction}
          onFail={onFail}
          onCancel={onCancel}
          onSuccess={onSuccess}
        />,
      );
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = getFooterActions().onConfirm?.();
      });
      await act(async () => {
        await getFooterActions().onConfirm?.();
      });
      expect(mockBatchSend).toHaveBeenCalledTimes(1);
      getFooterActions().onCancel(jest.fn(), jest.fn());
      await act(async () => {
        if (outcome === 'resolve') {
          resolveSend([]);
        } else {
          rejectSend(new Error('RPC timeout'));
        }
        await pending;
      });
      screen.unmount();
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onFail).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(mockNavigation.pop).not.toHaveBeenCalled();
      expect(mockNavigation.popStack).not.toHaveBeenCalled();
    },
  );

  it('still cancels an Infini confirmation dismissed without sending', () => {
    const onCancel = jest.fn();
    const screen = render(
      <TxConfirmActions
        accountId="hd-1--0"
        networkId="evm--1"
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        beforeBroadcastAction={beforeBroadcastAction}
        onCancel={onCancel}
      />,
    );
    screen.unmount();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockBatchSend).not.toHaveBeenCalled();
  });
});

describe('TxConfirmActions late broadcast observer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockBroadcastFact.mockReset();
    mockBroadcastFactByUuid
      .mockReset()
      .mockResolvedValue({ status: 'unknown' });
    mockAfterSendEnabled = false;
    mockAfterSend.mockReset().mockResolvedValue();
    mockGetWallet.mockReset().mockResolvedValue(undefined);
    mockGetDevice.mockReset().mockResolvedValue(undefined);
  });

  it.each(['afterSend', 'afterSendFailure', 'wallet'] as const)(
    'reports a verified broadcast without old UI when cancelled during %s',
    async (phase) => {
      let resolveGate: () => void = () => undefined;
      let rejectGate: (error: Error) => void = () => undefined;
      const gate = new Promise<void>((resolve, reject) => {
        resolveGate = resolve;
        rejectGate = reject;
      });
      mockAfterSendEnabled = phase !== 'wallet';
      if (phase === 'wallet')
        mockGetWallet.mockImplementation(async () => {
          await gate;
          return undefined;
        });
      else mockAfterSend.mockImplementation(() => gate);
      const fact = {
        uuid: 'tx-uuid-1',
        accountId: 'hd-1--0',
        networkId: 'evm--1',
        txid: 'txid-1',
      };
      mockBatchSend.mockResolvedValue([
        {
          signedTx: { uuid: fact.uuid, txid: fact.txid },
          decodedTx: { actions: [] },
        },
      ]);
      mockBroadcastFact.mockResolvedValue({ status: 'accepted', ...fact });
      const onSuccess = jest.fn();
      const onFail = jest.fn();
      const onLateBroadcastAccepted = jest.fn();
      render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          onSuccess={onSuccess}
          onFail={onFail}
          onLateBroadcastAccepted={onLateBroadcastAccepted}
        />,
      );
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = getFooterActions().onConfirm?.();
      });
      expect(
        phase === 'wallet' ? mockGetWallet : mockAfterSend,
      ).toHaveBeenCalledTimes(1);
      await act(async () => {
        getFooterActions().onCancel(jest.fn(), jest.fn());
        if (phase === 'afterSendFailure') rejectGate(new Error('late error'));
        else resolveGate();
        await pending;
      });
      expect(onLateBroadcastAccepted).toHaveBeenCalledTimes(1);
      expect(onLateBroadcastAccepted).toHaveBeenCalledWith(fact);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onFail).not.toHaveBeenCalled();
      expect(Toast.success).not.toHaveBeenCalled();
      expect(mockDappApprove.resolve).not.toHaveBeenCalled();
      expect(mockNavigation.pop).not.toHaveBeenCalled();
      expect(mockNavigation.popStack).not.toHaveBeenCalled();
    },
  );

  it('preserves the normal success handoff without reporting a late broadcast', async () => {
    mockAfterSendEnabled = true;
    mockBatchSend.mockResolvedValue([
      {
        signedTx: { uuid: 'tx-uuid-1', txid: 'txid-1' },
        decodedTx: { actions: [] },
      },
    ]);
    const onSuccess = jest.fn();
    const onLateBroadcastAccepted = jest.fn();
    render(
      <TxConfirmActions
        accountId="hd-1--0"
        networkId="evm--1"
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onSuccess={onSuccess}
        onLateBroadcastAccepted={onLateBroadcastAccepted}
      />,
    );
    await act(async () => {
      await getFooterActions().onConfirm?.();
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(Toast.success).toHaveBeenCalledTimes(1);
    expect(onLateBroadcastAccepted).not.toHaveBeenCalled();
    expect(mockBroadcastFact).not.toHaveBeenCalled();
    expect(mockBroadcastFactByUuid).not.toHaveBeenCalled();
  });

  it.each(['accepted', 'unknown', 'wrongAccount', 'wrongUuid'] as const)(
    'recovers only the scoped accepted fact if failure precedes the broadcast event (%s)',
    async (scenario) => {
      const fact = {
        uuid: 'tx-uuid-1',
        accountId: 'hd-1--0',
        networkId: 'evm--1',
        txid: 'txid-1',
      };
      mockBroadcastFactByUuid.mockResolvedValue(
        scenario === 'unknown'
          ? { status: 'unknown' }
          : {
              status: 'accepted',
              ...fact,
              ...(scenario === 'wrongAccount' ? { accountId: 'other' } : {}),
              ...(scenario === 'wrongUuid' ? { uuid: 'other' } : {}),
            },
      );
      mockBroadcastFact.mockResolvedValue({ status: 'accepted', ...fact });
      mockBatchSend.mockRejectedValue(new Error('history db locked'));
      const onLateBroadcastAccepted = jest.fn();
      const onFail = jest.fn();
      render(
        <TxConfirmActions
          accountId={fact.accountId}
          networkId={fact.networkId}
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          onFail={onFail}
          onLateBroadcastAccepted={onLateBroadcastAccepted}
        />,
      );
      await act(async () => {
        await expect(getFooterActions().onConfirm?.()).rejects.toThrow(
          'history db locked',
        );
      });
      // The cross-runtime event may arrive after the rejection and listener disposal.
      await act(async () => {
        appEventBus.emit(EAppEventBusNames.BatchSendTxBroadcasted, fact);
      });
      expect(mockBroadcastFactByUuid).toHaveBeenCalledWith({
        uuid: fact.uuid,
        accountId: fact.accountId,
        networkId: fact.networkId,
      });
      expect(onFail).toHaveBeenCalledTimes(1);
      if (scenario === 'accepted') {
        expect(onLateBroadcastAccepted).toHaveBeenCalledTimes(1);
        expect(onLateBroadcastAccepted).toHaveBeenCalledWith(fact);
      } else {
        expect(onLateBroadcastAccepted).not.toHaveBeenCalled();
      }
      expect(mockBatchSend).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['accepted', 'unknown'] as const)(
    'checks a broadcast before reporting a bookkeeping failure (%s)',
    async (status) => {
      const fact = {
        uuid: 'tx-uuid-1',
        accountId: 'hd-1--0',
        networkId: 'evm--1',
        txid: 'txid-1',
      };
      const error = new Error('history db locked');
      mockBroadcastFact.mockResolvedValue(
        status === 'accepted' ? { status, ...fact } : { status },
      );
      mockBroadcastFactByUuid.mockResolvedValue(
        status === 'accepted' ? { status, ...fact } : { status },
      );
      mockBatchSend.mockImplementation(async () => {
        appEventBus.emit(EAppEventBusNames.BatchSendTxBroadcasted, fact);
        throw error;
      });
      const onLateBroadcastAccepted = jest.fn();
      const onFail = jest.fn();
      const onSuccess = jest.fn();
      render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          onFail={onFail}
          onSuccess={onSuccess}
          onLateBroadcastAccepted={onLateBroadcastAccepted}
        />,
      );
      await act(async () => {
        await expect(getFooterActions().onConfirm?.()).rejects.toThrow(error);
      });
      expect(mockBroadcastFact).toHaveBeenCalledWith(fact);
      expect(onFail).toHaveBeenCalledWith(error);
      expect(onSuccess).not.toHaveBeenCalled();
      if (status === 'accepted') {
        expect(onLateBroadcastAccepted).toHaveBeenCalledTimes(1);
        expect(onLateBroadcastAccepted).toHaveBeenCalledWith(fact);
        expect(onFail.mock.invocationCallOrder[0]).toBeLessThan(
          onLateBroadcastAccepted.mock.invocationCallOrder[0],
        );
      } else {
        expect(onLateBroadcastAccepted).not.toHaveBeenCalled();
      }
    },
  );

  it('retains the accepted hash in the Earn task after a bookkeeping failure', async () => {
    const fact = {
      uuid: 'tx-uuid-1',
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      txid: 'txid-1',
    };
    mockBroadcastFact.mockResolvedValue({ status: 'accepted', ...fact });
    mockBroadcastFactByUuid.mockResolvedValue({ status: 'accepted', ...fact });
    mockBatchSend.mockImplementation(async () => {
      throw new OneKeyLocalError('history db locked');
    });
    const nextStep = jest.fn();
    const task = createDepositTask({
      taskId: 'deposit-task',
      identity: {
        accountId: fact.accountId,
        accountAddress: '0xpayer',
        networkId: fact.networkId,
        provider: 'native',
        vault: 'vault',
        inputTokenAddress: 'native',
        depositTokenAddress: 'wrapped',
        amount: '1',
        spenderAddress: 'spender',
      },
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
    const taskController = createDepositTaskController({
      task,
      isCurrent: () => true,
      onChange: () => undefined,
      adapter: {
        prepare: async ({ step }) => {
          if (step.id === 'deposit') nextStep();
          return { type: 'confirm', prepared: undefined };
        },
        confirm: async ({ signal, onBeforeSend, onLateBroadcastAccepted }) => {
          const result = await waitForEarnTransactionConfirm({
            navigationToTxConfirm: async (params) => {
              render(
                <TxConfirmActions
                  accountId={fact.accountId}
                  networkId={fact.networkId}
                  securityCheckConfirmation="none"
                  securityCheckAcknowledgementKey="tx-1"
                  onBeforeSend={params.onBeforeSend}
                  onFail={params.onFail}
                  onCancel={params.onCancel}
                  onSuccess={params.onSuccess}
                  onLateBroadcastAccepted={params.onLateBroadcastAccepted}
                />,
              );
            },
            signal,
            expiredMessage: 'expired',
            onSendStarted: onBeforeSend,
            onLateBroadcastAccepted: (broadcast) => {
              onLateBroadcastAccepted(broadcast.txid);
            },
          });
          return {
            type: result.status === 'cancel' ? 'cancelled' : 'submitted',
          };
        },
        waitForFinalStatus: async () => 'unknown',
        verify: async () => false,
      },
    });
    let operation: Promise<void> | undefined;
    await act(async () => {
      operation = taskController.run();
    });
    await act(async () => {
      await expect(getFooterActions().onConfirm?.()).rejects.toThrow(
        'history db locked',
      );
      await operation;
    });
    expect(taskController.getTask().steps[0].status).toEqual({
      type: 'unknown',
      txid: fact.txid,
      chainConfirmed: false,
    });
    expect(nextStep).not.toHaveBeenCalled();
    expect(mockBatchSend).toHaveBeenCalledTimes(1);
  });
  afterEach(() => {
    cleanup();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('reports only an accepted late broadcast after cancel without success side effects', async () => {
    let resolveSend: (value: unknown) => void = () => undefined;
    mockBatchSend.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );
    const fact = {
      uuid: 'tx-uuid-1',
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      txid: 'txid-1',
    };
    mockBroadcastFact.mockResolvedValue({ status: 'accepted', ...fact });
    const onLateBroadcastAccepted = jest.fn();
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    const screen = render(
      <TxConfirmActions
        accountId="hd-1--0"
        networkId="evm--1"
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onSuccess={onSuccess}
        onCancel={onCancel}
        onLateBroadcastAccepted={onLateBroadcastAccepted}
      />,
    );
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = getFooterActions().onConfirm?.();
    });
    await act(async () => {
      getFooterActions().onCancel(jest.fn(), jest.fn());
    });
    screen.unmount();
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.BatchSendTxBroadcasted, fact);
      resolveSend([{ signedTx: { uuid: fact.uuid, txid: fact.txid } }]);
      await pending;
    });
    expect(mockBroadcastFact).toHaveBeenCalledWith(fact);
    expect(onLateBroadcastAccepted).toHaveBeenCalledTimes(1);
    expect(onLateBroadcastAccepted).toHaveBeenCalledWith(fact);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockDappApprove.resolve).not.toHaveBeenCalled();
    expect(Toast.success).not.toHaveBeenCalled();
    expect(mockNavigation.pop).not.toHaveBeenCalled();
    expect(mockNavigation.popStack).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'mismatch', 'error', 'signOnly'] as const)(
    'does not report an unverified or nonbroadcast result (%s)',
    async (scenario) => {
      let resolveSend: (value: unknown) => void = () => undefined;
      mockBatchSend.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );
      const fact = {
        uuid: 'tx-uuid-1',
        accountId: 'hd-1--0',
        networkId: 'evm--1',
        txid: 'txid-1',
      };
      if (scenario === 'error')
        mockBroadcastFact.mockRejectedValue(new Error('unavailable'));
      else if (scenario === 'mismatch')
        mockBroadcastFact.mockResolvedValue({
          status: 'accepted',
          ...fact,
          accountId: 'other',
        });
      else mockBroadcastFact.mockResolvedValue({ status: 'unknown' });
      const onLateBroadcastAccepted = jest.fn();
      render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          signOnly={scenario === 'signOnly'}
          onLateBroadcastAccepted={onLateBroadcastAccepted}
        />,
      );
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = getFooterActions().onConfirm?.();
      });
      await act(async () => {
        getFooterActions().onCancel(jest.fn(), jest.fn());
      });
      await act(async () => {
        appEventBus.emit(EAppEventBusNames.BatchSendTxBroadcasted, fact);
        resolveSend([{ signedTx: { uuid: fact.uuid, txid: fact.txid } }]);
        await pending;
      });
      expect(onLateBroadcastAccepted).not.toHaveBeenCalled();
      if (scenario === 'signOnly')
        expect(mockBroadcastFact).not.toHaveBeenCalled();
    },
  );

  it('checks each matching batch event independently when the batch later rejects', async () => {
    let rejectSend: (error: Error) => void = () => undefined;
    mockUnsignedTxs.push({
      uuid: 'tx-uuid-2',
      encodedTx: { from: '0xpayer', to: '0xrecipient', value: '0x1' },
      nonce: 2,
    });
    mockBatchSend.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSend = reject;
        }),
    );
    mockBroadcastFact.mockImplementation(async (value) => ({
      status: 'accepted',
      ...(value as object),
    }));
    const first = {
      uuid: 'tx-uuid-1',
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      txid: 'txid-1',
    };
    const second = { ...first, uuid: 'tx-uuid-2', txid: 'txid-2' };
    const observer = jest.fn();
    render(
      <TxConfirmActions
        accountId="hd-1--0"
        networkId="evm--1"
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onLateBroadcastAccepted={observer}
      />,
    );
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = getFooterActions().onConfirm?.();
    });
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.BatchSendTxBroadcasted, first);
      appEventBus.emit(EAppEventBusNames.BatchSendTxBroadcasted, {
        ...first,
        uuid: 'unrelated',
      });
      expect(observer).not.toHaveBeenCalled();
      getFooterActions().onCancel(jest.fn(), jest.fn());
      appEventBus.emit(EAppEventBusNames.BatchSendTxBroadcasted, second);
      rejectSend(new Error('later batch item failed'));
      await pending;
    });
    expect(observer).toHaveBeenCalledTimes(2);
    expect(observer).toHaveBeenCalledWith(first);
    expect(observer).toHaveBeenCalledWith(second);
    expect(mockBroadcastFact).toHaveBeenCalledTimes(2);
    mockUnsignedTxs.pop();
  });
});

describe('TxConfirmActions result-unknown latch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLatchedTxUuids.clear();
  });
  afterEach(() => {
    cleanup();
  });

  const renderScreen = (onFail?: jest.Mock) =>
    render(
      <TxConfirmActions
        accountId="hd-1--0"
        networkId="evm--1"
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onFail={onFail}
      />,
    );

  it.each([90_200, 90_205, 90_219])(
    'latches the tx after error %s instead of touching the quote',
    async (code) => {
      mockBatchSend.mockRejectedValue(
        Object.assign(new Error('execute failed'), { code }),
      );
      const onFail = jest.fn();
      renderScreen(onFail);

      await act(async () => {
        await expect(getFooterActions().onConfirm?.()).rejects.toThrow(
          'execute failed',
        );
      });

      expect(
        mockActions.markGasAccountSubmitResultUnknown,
      ).toHaveBeenCalledWith('tx-uuid-1');
      expect(mockActions.resetGasAccountUiState).not.toHaveBeenCalled();
      expect(mockActions.updateGasAccountUiState).not.toHaveBeenCalled();
      expect(onFail).toHaveBeenCalledTimes(1);
      expect(mockNavigation.pop).not.toHaveBeenCalled();
      expect(mockNavigation.popStack).not.toHaveBeenCalled();
    },
  );

  it('does not latch on a refresh code that sent nothing', async () => {
    mockBatchSend.mockRejectedValue(
      Object.assign(new Error('nonce changed'), { code: 40_209 }),
    );
    renderScreen();

    await act(async () => {
      await getFooterActions().onConfirm?.();
    });

    expect(
      mockActions.markGasAccountSubmitResultUnknown,
    ).not.toHaveBeenCalled();
  });

  it('keeps confirm disabled once the tx is latched', () => {
    mockLatchedTxUuids.add('tx-uuid-1');
    renderScreen();

    expect(getFooterActions().confirmButtonProps?.disabled).toBe(true);
  });
});

describe('TxConfirmActions sent-txs tracking', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('keeps one tracking id across retries of the same screen', async () => {
    mockBatchSend.mockRejectedValue(new Error('broadcast failed'));
    const renderScreen = () =>
      render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
        />,
      );
    const confirmAndFail = () =>
      act(async () => {
        await expect(getFooterActions().onConfirm?.()).rejects.toThrow(
          'broadcast failed',
        );
      });

    const screen = renderScreen();
    await confirmAndFail();
    await confirmAndFail();
    screen.unmount();
    renderScreen();
    await confirmAndFail();

    const trackingIds = mockBatchSend.mock.calls.map(
      ([params]) =>
        (params as { sentTxsTrackingId?: string }).sentTxsTrackingId,
    );
    expect(trackingIds[0]).toEqual(expect.any(String));
    expect(trackingIds[1]).toBe(trackingIds[0]);
    expect(trackingIds[2]).toEqual(expect.any(String));
    expect(trackingIds[2]).not.toBe(trackingIds[0]);
  });
});
