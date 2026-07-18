/** @jest-environment jsdom */

import { act, render, waitFor } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import TxConfirmActions from './TxConfirmActions';

let mockFooterOnConfirm: (() => Promise<void>) | undefined;
let mockPageUnmountCallback: (() => void) | undefined;

const mockAbortGasAccountSubmit = jest
  .fn<Promise<void>, [string]>()
  .mockResolvedValue(undefined);
const mockToastError = jest.fn();
const mockUpdateSendTxStatus = jest.fn();
const mockDappResolve = jest.fn().mockResolvedValue(undefined);
const mockDappReject = jest.fn().mockResolvedValue(undefined);
const mockNavigationPop = jest.fn();
const mockNavigationPopStack = jest.fn();
const mockUnsignedTx = {
  encodedTx: { data: '0x', value: '0x0' },
  nonce: 1,
};
const mockBatchSignAndSendTransaction = jest.fn<Promise<unknown>, [unknown]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Checkbox: () => null,
    Page: {
      Footer: ({ children }: { children?: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
      FooterActions: ({
        children,
        onConfirm,
      }: {
        children?: React.ReactNode;
        onConfirm: () => Promise<void>;
      }) => {
        mockFooterOnConfirm = onConfirm;
        return React.createElement(React.Fragment, null, children);
      },
    },
    Stack: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Toast: {
      error: (params: unknown) => {
        mockToastError(params);
      },
      success: jest.fn(),
      warning: jest.fn(),
    },
    usePageUnMounted: (callback: () => void) => {
      mockPageUnmountCallback = callback;
    },
    useSafeAreaInsets: () => ({ bottom: 0 }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      checkIsWalletNotBackedUp: jest.fn().mockResolvedValue(false),
      getAccountAddressForApi: jest.fn().mockResolvedValue('0xsender'),
    },
    serviceHistory: {
      getAccountsLocalHistoryTxs: jest.fn().mockResolvedValue([]),
    },
    serviceNetwork: {
      getVaultSettings: jest.fn().mockResolvedValue({}),
    },
    serviceSend: {
      abortGasAccountSubmit: (submitId: string) =>
        mockAbortGasAccountSubmit(submitId),
      batchSignAndSendTransaction: (request: unknown) =>
        mockBatchSignAndSendTransaction(request),
      checkAddressBeforeSending: jest.fn().mockResolvedValue(undefined),
      getNextNonce: jest.fn().mockResolvedValue(1),
      precheckUnsignedTxs: jest.fn().mockResolvedValue(undefined),
      updateUnSignedTxBeforeSending: jest
        .fn()
        .mockImplementation(async () => [mockUnsignedTx]),
    },
    serviceSignatureConfirm: {
      afterSendTxAction: jest.fn().mockResolvedValue(undefined),
      preActionsBeforeSending: jest.fn().mockResolvedValue(undefined),
      updateRecentRecipients: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pop: mockNavigationPop,
    popStack: mockNavigationPopStack,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useDappApproveAction', () => ({
  __esModule: true,
  default: () => ({
    reject: mockDappReject,
    resolve: mockDappResolve,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useInterval', () => ({
  useInterval: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: {} }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useShouldRejectDappAction', () => ({
  __esModule: true,
  default: () => ({ shouldRejectDappAction: () => true }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm', () => ({
  useCustomRpcStatusAtom: () => [undefined],
  useDecodedTxsAtom: () => [{ decodedTxs: [{}], isBuildingDecodedTxs: false }],
  useDecodedTxsInitAtom: () => [true],
  useEffectiveFeePayerAtom: () => ['user'],
  useGasAccountUiStateAtom: () => [{}],
  useMegafuelEligibleAtom: () => [{ sponsorable: false }],
  useNativeTokenInfoAtom: () => [{ info: { symbol: 'ETH' }, isLoading: false }],
  useNativeTokenTransferAmountToUpdateAtom: () => [
    { amountToUpdate: undefined, isMaxSend: false },
  ],
  usePreCheckTxStatusAtom: () => [{}],
  useSendFeeStatusAtom: () => [{ discountPercent: 0, errMessage: '' }],
  useSendSelectedFeeInfoAtom: () => [undefined],
  useSendTxStatusAtom: () => [
    {
      isInsufficientNativeBalance: false,
      isInsufficientTokenBalance: false,
      isSubmitting: false,
    },
  ],
  useSignatureConfirmActions: () => ({
    current: {
      resetGasAccountTemporarilyDisabled: jest.fn(),
      resetGasAccountUiState: jest.fn(),
      updateEffectiveFeePayer: jest.fn(),
      updateGasAccountTemporarilyDisabled: jest.fn(),
      updateGasAccountUiState: jest.fn(),
      updateSendFeeStatus: jest.fn(),
      updateSendTxStatus: mockUpdateSendTxStatus,
      updateTxFeeInfoInit: jest.fn(),
      updateUnsignedTxs: jest.fn(),
    },
  }),
  useTronResourceRentalInfoAtom: () => [undefined],
  useTxAdvancedSettingsAtom: () => [{}],
  useTxFeeInfoInitAtom: () => [true],
  useUnsignedTxsAtom: () => [[mockUnsignedTx]],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'USD' } }],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    EstimateTxFeeRetry: 'EstimateTxFeeRetry',
    GasAccountSubmitRetryCleared: 'GasAccountSubmitRetryCleared',
    GasAccountSubmitRetryScheduled: 'GasAccountSubmitRetryScheduled',
  },
  appEventBus: {
    emit: jest.fn(),
    off: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: jest.fn() } },
    transaction: { send: { sendConfirm: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    getWalletIdFromAccountId: () => 'wallet-a',
    isQrAccount: () => false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/evmUtils', () => ({
  checkIsEmptyData: () => true,
}));

jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: () => 'submit-a',
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isLightningNetworkByNetworkId: () => false,
    isTronNetworkByNetworkId: () => false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/txActionUtils', () => ({
  getTxnType: () => 'transfer',
}));

jest.mock('../../hooks/usePreCheckFeeInfo', () => ({
  usePreCheckFeeInfo: () => ({
    checkFeeInfoIsOverflow: jest.fn().mockResolvedValue(false),
    showFeeInfoOverflowConfirm: jest.fn().mockResolvedValue(true),
  }),
}));

jest.mock('../CustomHexDataAlert', () => ({
  showCustomHexDataAlert: jest.fn(),
}));

jest.mock('../TxFee', () => () => null);

jest.mock('./txConfirmPostSendUtils', () => ({
  runTxConfirmPostSendTask: async ({
    action,
  }: {
    action: () => Promise<void>;
  }) => action(),
  syncBatchSendSuccessfullySentTxsFromError: jest.fn(),
}));

function renderActions(
  beforeConfirm: (phase: 'submit' | 'sign') => Promise<void>,
) {
  render(
    <TxConfirmActions
      accountId="account-a"
      beforeConfirm={beforeConfirm}
      networkId="evm--1"
      signOnly
    />,
  );
  if (!mockFooterOnConfirm) {
    throw new OneKeyLocalError('TxConfirm onConfirm was not rendered');
  }
  return mockFooterOnConfirm;
}

describe('TxConfirmActions preflight wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFooterOnConfirm = undefined;
    mockPageUnmountCallback = undefined;
    mockBatchSignAndSendTransaction.mockResolvedValue([
      {
        decodedTx: { actions: [] },
        signedTx: { txid: '0xsigned' },
      },
    ]);
  });

  it('keeps the component submit lease across the final async batch sign attempt', async () => {
    const callOrder: string[] = [];
    let releaseBatch!: () => void;
    const batchDeferred = new Promise<void>((resolve) => {
      releaseBatch = resolve;
    });
    const beforeConfirm = jest.fn(async (phase: 'submit' | 'sign') => {
      callOrder.push(phase);
    });
    mockBatchSignAndSendTransaction.mockImplementation(async () => {
      callOrder.push('batch-start');
      await batchDeferred;
      callOrder.push('batch-end');
      return [
        {
          decodedTx: { actions: [] },
          signedTx: { txid: '0xsigned' },
        },
      ];
    });
    const onConfirm = renderActions(beforeConfirm);

    let firstAttempt!: Promise<void>;
    act(() => {
      firstAttempt = onConfirm();
    });
    await waitFor(() => {
      expect(mockBatchSignAndSendTransaction).toHaveBeenCalledTimes(1);
    });

    let duplicateAttempt!: Promise<void>;
    act(() => {
      duplicateAttempt = onConfirm();
    });
    await Promise.resolve();

    expect(callOrder).toEqual(['submit', 'sign', 'batch-start']);
    expect(beforeConfirm.mock.calls).toEqual([['submit'], ['sign']]);
    expect(mockBatchSignAndSendTransaction).toHaveBeenCalledTimes(1);

    releaseBatch();
    await act(async () => {
      await Promise.all([firstAttempt, duplicateAttempt]);
    });

    expect(callOrder).toEqual(['submit', 'sign', 'batch-start', 'batch-end']);
  });

  it('does not reach the component batch signer when final preflight rejects', async () => {
    let rejectNextSign = true;
    const beforeConfirm = jest.fn(async (phase: 'submit' | 'sign') => {
      if (phase === 'sign' && rejectNextSign) {
        rejectNextSign = false;
        throw new OneKeyLocalError('market is closed');
      }
    });
    const onConfirm = renderActions(beforeConfirm);

    await act(async () => {
      await onConfirm();
    });

    expect(beforeConfirm.mock.calls).toEqual([['submit'], ['sign']]);
    expect(mockBatchSignAndSendTransaction).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith({
      title: 'market is closed',
    });
    expect(mockUpdateSendTxStatus).toHaveBeenCalledWith({
      isSubmitting: false,
    });

    await act(async () => {
      await onConfirm();
    });

    expect(beforeConfirm.mock.calls).toEqual([
      ['submit'],
      ['sign'],
      ['submit'],
      ['sign'],
    ]);
    expect(mockBatchSignAndSendTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not start the signer after unmount cancels a pending final preflight', async () => {
    let resolveSignPreflight: (() => void) | undefined;
    const beforeConfirm = jest.fn((phase: 'submit' | 'sign') => {
      if (phase === 'sign') {
        return new Promise<void>((resolve) => {
          resolveSignPreflight = resolve;
        });
      }
      return Promise.resolve();
    });
    const onConfirm = renderActions(beforeConfirm);

    let attempt!: Promise<void>;
    act(() => {
      attempt = onConfirm();
    });
    await waitFor(() => {
      expect(beforeConfirm).toHaveBeenCalledWith('sign');
    });

    act(() => {
      mockPageUnmountCallback?.();
    });
    expect(mockAbortGasAccountSubmit).toHaveBeenCalledWith('submit-a');

    resolveSignPreflight?.();
    await act(async () => {
      await attempt;
    });

    expect(mockBatchSignAndSendTransaction).not.toHaveBeenCalled();
  });
});
