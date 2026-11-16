/** @jest-environment jsdom */
/* cspell:ignore Infini */
import type { ReactNode } from 'react';

import { act, cleanup, render } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPrimeInfiniBeforeBroadcastAction } from '@onekeyhq/shared/types/prime/primeTypes';
import type { IBroadcastAcceptedFact } from '@onekeyhq/shared/types/tx';

import TxConfirmActions from './TxConfirmActions';

type IFooterActions = {
  onConfirm?: () => Promise<void>;
  onCancel: (close: () => void, closePageStack: () => void) => void;
  confirmButtonProps?: { disabled: boolean };
};

const mockFooterActions = jest.fn<null, [IFooterActions]>(() => null);
const mockBatchSend = jest.fn<Promise<unknown>, [unknown]>();
const mockGetWallet = jest.fn<Promise<unknown>, [unknown]>();
const mockGetAcceptance = jest.fn<
  Promise<
    ({ status: 'accepted' } & IBroadcastAcceptedFact) | { status: 'unknown' }
  >,
  [unknown]
>();
const mockBroadcastListeners = new Set<
  (fact: IBroadcastAcceptedFact) => void
>();
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
  Toast: { warning: jest.fn(), success: jest.fn() },
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
      getWallet: (params: unknown) => mockGetWallet(params),
      getAccountDeviceSafe: jest.fn(async () => undefined),
    },
    serviceSignatureConfirm: {
      preActionsBeforeSending: jest.fn(async () => undefined),
    },
    serviceSend: {
      releaseUnsignedTxs: jest.fn(async () => undefined),
      precheckUnsignedTxs: jest.fn(async () => undefined),
      updateUnSignedTxBeforeSending: jest.fn(async () => mockUnsignedTxs),
      batchSignAndSendTransaction: (params: unknown) => mockBatchSend(params),
      getBroadcastAcceptanceFactByUuid: (params: unknown) =>
        mockGetAcceptance(params),
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
    result: { nonceRequired: false, replaceTxEnabled: false },
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
    { selectedPayer: 'gasAccount', gasAccountQuote: { quoteId: 'quote-1' } },
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
    on: jest.fn(
      (name: string, callback: (fact: IBroadcastAcceptedFact) => void) => {
        if (name === 'BatchSendTxBroadcasted')
          mockBroadcastListeners.add(callback);
      },
    ),
    off: jest.fn(
      (name: string, callback: (fact: IBroadcastAcceptedFact) => void) => {
        if (name === 'BatchSendTxBroadcasted')
          mockBroadcastListeners.delete(callback);
      },
    ),
    emit: jest.fn(),
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    transaction: {
      send: { gasAccountAction: jest.fn(), gasAccountDecision: jest.fn() },
    },
  },
}));
jest.mock('../../hooks/usePreCheckFeeInfo', () => ({
  usePreCheckFeeInfo: () => ({
    checkFeeInfoIsOverflow: jest.fn(async () => false),
    showFeeInfoOverflowConfirm: jest.fn(async () => true),
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
    mockBroadcastListeners.clear();
    mockGetAcceptance.mockReset().mockResolvedValue({ status: 'unknown' });
    mockGetWallet.mockReset().mockResolvedValue(undefined);
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

  it.each(['resolve', 'reject'] as const)(
    'does not fail again when cancelled during before-send verification and it later %s',
    async (outcome) => {
      let resolve: () => void = () => undefined;
      let reject: (error: Error) => void = () => undefined;
      const onBeforeSend = jest.fn(
        () =>
          new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
          }),
      );
      const onBroadcastStart = jest.fn();
      const onFail = jest.fn();
      const onCancel = jest.fn();
      const screen = render(
        <TxConfirmActions
          accountId="hd-1--0"
          networkId="evm--1"
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          onBeforeSend={onBeforeSend}
          onBroadcastStart={onBroadcastStart}
          onFail={onFail}
          onCancel={onCancel}
        />,
      );
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = getFooterActions().onConfirm?.();
      });
      expect(onBeforeSend).toHaveBeenCalledTimes(1);
      act(() => getFooterActions().onCancel(jest.fn(), jest.fn()));
      await act(async () => {
        if (outcome === 'resolve') resolve();
        else reject(new Error('verification failed'));
        await pending;
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onFail).not.toHaveBeenCalled();
      expect(onBroadcastStart).not.toHaveBeenCalled();
      expect(mockBatchSend).not.toHaveBeenCalled();
      expect(mockDappApprove.reject).toHaveBeenCalledTimes(1);
      screen.unmount();
    },
  );

  it.each(['before', 'after'] as const)(
    'reports a verified late broadcast when its event arrives %s cancellation',
    async (timing) => {
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
        txid: `0x${'a'.repeat(64)}`,
      };
      const onLate = jest.fn();
      const onSuccess = jest.fn();
      const screen = render(
        <TxConfirmActions
          accountId={fact.accountId}
          networkId={fact.networkId}
          securityCheckConfirmation="none"
          securityCheckAcknowledgementKey="tx-1"
          onSuccess={onSuccess}
          onLateBroadcastAccepted={onLate}
        />,
      );
      let pending: Promise<void> | undefined;
      await act(async () => {
        pending = getFooterActions().onConfirm?.();
      });
      expect(mockBatchSend).toHaveBeenCalledTimes(1);
      expect(mockBroadcastListeners.size).toBe(1);
      if (timing === 'before') {
        act(() => mockBroadcastListeners.forEach((listener) => listener(fact)));
        expect(onLate).not.toHaveBeenCalled();
      }
      mockGetAcceptance.mockResolvedValue({ status: 'accepted', ...fact });
      act(() => getFooterActions().onCancel(jest.fn(), jest.fn()));
      if (timing === 'after') {
        act(() => mockBroadcastListeners.forEach((listener) => listener(fact)));
      }
      await act(async () => {
        resolveSend([]);
        await pending;
      });
      expect(onLate).toHaveBeenCalledTimes(1);
      expect(onLate).toHaveBeenCalledWith({ status: 'accepted', ...fact });
      expect(onSuccess).not.toHaveBeenCalled();
      expect(mockBroadcastListeners.size).toBe(0);
      screen.unmount();
    },
  );

  it('ignores a late event that the background record does not confirm', async () => {
    let rejectSend: (error: Error) => void = () => undefined;
    mockBatchSend.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSend = reject;
        }),
    );
    const onLate = jest.fn();
    const screen = render(
      <TxConfirmActions
        accountId="hd-1--0"
        networkId="evm--1"
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onLateBroadcastAccepted={onLate}
      />,
    );
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = getFooterActions().onConfirm?.();
    });
    act(() => getFooterActions().onCancel(jest.fn(), jest.fn()));
    act(() =>
      mockBroadcastListeners.forEach((listener) =>
        listener({
          uuid: 'tx-uuid-1',
          accountId: 'hd-1--0',
          networkId: 'evm--1',
          txid: `0x${'b'.repeat(64)}`,
        }),
      ),
    );
    await act(async () => {
      rejectSend(new Error('history failed'));
      await pending;
    });
    expect(onLate).not.toHaveBeenCalled();
    expect(mockBroadcastListeners.size).toBe(1);
    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
    });
    expect(mockBroadcastListeners.size).toBe(0);
    screen.unmount();
  });

  it('observes an accepted broadcast after the sending IPC rejects', async () => {
    let rejectSend: (error: Error) => void = () => undefined;
    mockBatchSend.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSend = reject;
        }),
    );
    const fact = {
      uuid: 'tx-uuid-1',
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      txid: `0x${'c'.repeat(64)}`,
    };
    const onLate = jest.fn();
    const screen = render(
      <TxConfirmActions
        accountId={fact.accountId}
        networkId={fact.networkId}
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onLateBroadcastAccepted={onLate}
      />,
    );
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = getFooterActions().onConfirm?.();
    });
    act(() => getFooterActions().onCancel(jest.fn(), jest.fn()));
    await act(async () => {
      rejectSend(new Error('bridge closed'));
      await pending;
    });
    expect(mockBroadcastListeners.size).toBe(1);
    mockGetAcceptance.mockResolvedValue({ status: 'accepted', ...fact });
    await act(async () => {
      mockBroadcastListeners.forEach((listener) => listener(fact));
      await Promise.resolve();
    });
    expect(onLate).toHaveBeenCalledTimes(1);
    expect(mockBroadcastListeners.size).toBe(0);
    screen.unmount();
  });

  it('stops observing a cancelled request that never settles without claiming success', async () => {
    mockBatchSend.mockImplementation(() => new Promise(() => undefined));
    const onLate = jest.fn();
    const screen = render(
      <TxConfirmActions
        accountId="hd-1--0"
        networkId="evm--1"
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onLateBroadcastAccepted={onLate}
      />,
    );
    await act(async () => {
      void getFooterActions().onConfirm?.();
    });
    expect(mockBroadcastListeners.size).toBe(1);
    act(() => getFooterActions().onCancel(jest.fn(), jest.fn()));
    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
    });
    expect(mockBroadcastListeners.size).toBe(0);
    expect(onLate).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('reconciles acceptance instead of running success UI after cancellation during wallet lookup', async () => {
    let resolveWallet: (value: unknown) => void = () => undefined;
    mockGetWallet.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWallet = resolve;
        }),
    );
    const fact = {
      uuid: 'tx-uuid-1',
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      txid: `0x${'a'.repeat(64)}`,
    };
    mockGetAcceptance.mockResolvedValue({ status: 'accepted', ...fact });
    mockBatchSend.mockResolvedValue([
      { signedTx: { txid: fact.txid }, decodedTx: { actions: [] } },
    ]);
    const onLate = jest.fn();
    const onSuccess = jest.fn();
    const screen = render(
      <TxConfirmActions
        accountId={fact.accountId}
        networkId={fact.networkId}
        securityCheckConfirmation="none"
        securityCheckAcknowledgementKey="tx-1"
        onSuccess={onSuccess}
        onLateBroadcastAccepted={onLate}
      />,
    );
    let pending: Promise<void> | undefined;
    await act(async () => {
      pending = getFooterActions().onConfirm?.();
    });
    expect(mockGetWallet).toHaveBeenCalledTimes(1);
    act(() => getFooterActions().onCancel(jest.fn(), jest.fn()));
    await act(async () => {
      resolveWallet(undefined);
      await pending;
    });
    expect(onLate).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockNavigation.pop).not.toHaveBeenCalled();
    expect(mockNavigation.popStack).not.toHaveBeenCalled();
    screen.unmount();
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
