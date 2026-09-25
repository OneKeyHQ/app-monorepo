/** @jest-environment jsdom */
/* cspell:ignore Infini */
import type { ReactNode } from 'react';

import { act, cleanup, render } from '@testing-library/react';

import type { IPrimeInfiniBeforeBroadcastAction } from '@onekeyhq/shared/types/prime/primeTypes';

import TxConfirmActions from './TxConfirmActions';

type IFooterActions = {
  onConfirm?: () => Promise<void>;
  onCancel: (close: () => void, closePageStack: () => void) => void;
  confirmButtonProps?: { disabled: boolean };
};

const mockFooterActions = jest.fn<null, [IFooterActions]>(() => null);
const mockBatchSend = jest.fn<Promise<unknown>, [unknown]>();
const mockNavigation = { pop: jest.fn(), popStack: jest.fn() };
const mockDappApprove = { resolve: jest.fn(), reject: jest.fn() };
const mockUnsignedTxs = [{ encodedTx: { value: '0x1' }, nonce: 1 }];
const mockActions = {
  updateEffectiveFeePayer: jest.fn(),
  updateGasAccountTemporarilyDisabled: jest.fn(),
  resetGasAccountTemporarilyDisabled: jest.fn(),
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
    },
    serviceSignatureConfirm: {
      preActionsBeforeSending: jest.fn(async () => undefined),
    },
    serviceSend: {
      precheckUnsignedTxs: jest.fn(async () => undefined),
      updateUnSignedTxBeforeSending: jest.fn(async () => mockUnsignedTxs),
      batchSignAndSendTransaction: (params: unknown) => mockBatchSend(params),
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
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
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
