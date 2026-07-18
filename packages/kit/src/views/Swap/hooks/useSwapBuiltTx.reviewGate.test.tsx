/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type {
  IFetchQuoteResult,
  ISwapGasInfo,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapNetworkFeeLevel,
  ESwapQuoteKind,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { type ISwapQuoteSessionState } from '../../../states/jotai/contexts/swap/quoteSessionV2';
import {
  ESwapStockMarketQuoteGateStatus,
  type ISwapStockMarketQuoteGate,
  getSwapStockMarketQuoteOwnerKey,
} from '../../../states/jotai/contexts/swap/stockMarketQuoteGate';
import {
  ESwapExecutionRecipientMode,
  type ISwapExecutionSnapshot,
} from '../utils/swapReviewState';

import { useSwapBuildTx } from './useSwapBuiltTx';

type IMockSwapStepsState = {
  steps: ISwapStep[];
  preSwapData: ISwapPreSwapData;
  quoteResult?: IFetchQuoteResult;
};
type IMockSwapStepsUpdate =
  | IMockSwapStepsState
  | ((previous: IMockSwapStepsState) => IMockSwapStepsState);

const mockFetchBuildTx = jest.fn<Promise<unknown>, [unknown]>();
const mockFetchSwapTokenDetails = jest.fn<Promise<unknown[]>, [unknown]>();
const mockSignMessage = jest.fn<Promise<string>, [unknown]>();
const mockSignAndSendTransaction = jest.fn<Promise<unknown>, [unknown]>();
const mockPrepareSendConfirmUnsignedTx = jest.fn<Promise<unknown>, [unknown]>();
const mockUpdateUnsignedTx = jest.fn<Promise<unknown>, [unknown]>();
const mockPrecheckUnsignedTxs = jest.fn<Promise<void>, [unknown]>();
const mockVerifyTransaction = jest.fn<Promise<void>, [unknown]>();
const mockBuildDecodedTx = jest.fn<Promise<unknown>, [unknown]>();
const mockSaveSendConfirmHistoryTxs = jest.fn<Promise<void>, [unknown]>();
const mockGetVaultSettings = jest.fn<Promise<unknown>, [unknown]>();
const mockFetchMarketTokenDetail = jest.fn<
  Promise<unknown>,
  [string, string, unknown]
>();
const mockSetSwapSteps = jest.fn<void, [IMockSwapStepsUpdate]>();
const mockNavigationToTxConfirm = jest.fn<
  Promise<void>,
  [
    {
      beforeConfirm?: (phase: 'submit' | 'sign') => void | Promise<void>;
      [key: string]: unknown;
    },
  ]
>();

const mockPayToken: ISwapToken = {
  contractAddress: '0xpay',
  decimals: 6,
  networkId: 'evm--1',
  symbol: 'USDC',
};
const mockStockToken: ISwapToken = {
  contractAddress: '0xstock',
  decimals: 18,
  isStock: true,
  networkId: 'evm--1',
  symbol: 'STOCK',
};
const mockSwapToken: ISwapToken = {
  contractAddress: '0xswap',
  decimals: 18,
  networkId: 'evm--1',
  symbol: 'SWAP',
};

const mockStockOwnerKey = getSwapStockMarketQuoteOwnerKey({
  fromToken: mockPayToken,
  toToken: mockStockToken,
});

let mockExecutionSnapshot: ISwapExecutionSnapshot;
let mockQuoteSessionState: ISwapQuoteSessionState;
let mockStockMarketQuoteGate: ISwapStockMarketQuoteGate | undefined;
let mockSwapStepsState: IMockSwapStepsState;
let mockStepTransitions: ESwapStepStatus[];
let mockFromAccountId: string;
let mockFromNetworkId: string;
let mockFromUserAddress: string;

jest.mock('@cowprotocol/contracts', () => ({
  OrderBalance: { ERC20: 'erc20' },
  hashify: (value: string) => value,
  normalizeBuyTokenBalance: (value: string) => value,
  timestamp: (value: number) => value,
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
  rootNavigationRef: { current: undefined },
  useIsOverlayPage: () => false,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useInAppNotificationAtom: () => [{}, jest.fn()],
  useSettingsAtom: () => [{}, jest.fn()],
  useSettingsPersistAtom: () => [{ isFirstTimeSwap: false }, jest.fn()],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: jest.fn() } },
    swap: {
      cancelLimitOrder: { cancelLimitOrder: jest.fn() },
      createSwapOrder: { swapCreateOrder: jest.fn() },
      swapEstimateFee: { swapEstimateFee: jest.fn() },
      swapSendTx: { swapSendTx: jest.fn() },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: {
    emit: jest.fn(),
    off: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isJest: true, isNative: false },
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketTokenDetailByTokenAddress: (
        tokenAddress: string,
        networkId: string,
        options: unknown,
      ) => mockFetchMarketTokenDetail(tokenAddress, networkId, options),
    },
    serviceSend: {
      buildDecodedTx: (params: unknown) => mockBuildDecodedTx(params),
      precheckUnsignedTxs: (params: unknown) => mockPrecheckUnsignedTxs(params),
      prepareSendConfirmUnsignedTx: (params: unknown) =>
        mockPrepareSendConfirmUnsignedTx(params),
      signAndSendTransaction: (params: unknown) =>
        mockSignAndSendTransaction(params),
      signMessage: (params: unknown) => mockSignMessage(params),
      updateUnsignedTx: (params: unknown) => mockUpdateUnsignedTx(params),
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: (params: unknown) =>
        mockSaveSendConfirmHistoryTxs(params),
    },
    serviceNetwork: {
      getVaultSettings: (params: unknown) => mockGetVaultSettings(params),
    },
    serviceNotification: {
      blockNotificationForTxId: jest.fn().mockResolvedValue(undefined),
    },
    serviceSwap: {
      fetchBuildTx: (params: unknown) => mockFetchBuildTx(params),
      fetchSwapTokenDetails: (params: unknown) =>
        mockFetchSwapTokenDetails(params),
    },
    serviceTransaction: {
      verifyTransaction: (params: unknown) => mockVerifyTransaction(params),
    },
  },
}));

jest.mock('../../../hooks/useSignatureConfirm', () => ({
  useSignatureConfirm: () => ({
    navigationToMessageConfirm: jest.fn(),
    navigationToTxConfirm: mockNavigationToTxConfirm,
  }),
}));

jest.mock('../../../states/jotai/contexts/swap', () => ({
  useSwapBuildTxFetchingAtom: () => [false, jest.fn()],
  useSwapFromTokenAmountAtom: () => [{ value: '', isInput: true }, jest.fn()],
  useSwapLimitExpirationTimeAtom: () => [{ value: '3600' }],
  useSwapLimitPartiallyFillAtom: () => [{ value: true }],
  useSwapLimitPriceFromAmountAtom: () => [''],
  useSwapLimitPriceToAmountAtom: () => [''],
  useSwapProInputAmountAtom: () => [{ value: '' }, jest.fn()],
  useSwapQuoteEventTotalCountAtom: () => [{ count: 0 }, jest.fn()],
  useSwapQuoteListAtom: () => [[], jest.fn()],
  useSwapQuoteSessionStateAtom: () => [mockQuoteSessionState],
  useSwapReviewExecutionSnapshotAtom: () => [mockExecutionSnapshot],
  useSwapStepNetFeeLevelAtom: () => [
    { networkFeeLevel: ESwapNetworkFeeLevel.MEDIUM },
  ],
  useSwapStepsAtom: () => [mockSwapStepsState, mockSetSwapSteps],
  useSwapStockMarketQuoteGateAtom: () => [mockStockMarketQuoteGate],
  useSwapToTokenAmountAtom: () => [{ value: '', isInput: false }, jest.fn()],
  useSwapTypeSwitchAtom: () => [
    mockExecutionSnapshot?.swapType ?? ESwapTabSwitchType.STOCK,
  ],
}));

jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: () => ({
    accountInfo: {
      account: { id: mockFromAccountId },
      dbAccount: { id: 'db-a' },
      deriveInfo: {},
      indexedAccount: { id: 'indexed-a' },
      wallet: { id: 'wallet-a', type: 'hd' },
    },
    address: mockFromUserAddress,
    networkId: mockFromNetworkId,
  }),
}));

jest.mock('./useSwapPro', () => ({
  useSwapBuildTxInfo: () => ({
    currentQuoteRes: mockExecutionSnapshot?.quoteResult,
    fromSelectToken: mockExecutionSnapshot?.fromToken,
    toSelectToken: mockExecutionSnapshot?.toToken,
  }),
  useSwapProAccount: () => ({}),
}));

jest.mock('./useSwapState', () => ({
  useSwapActionState: () => ({ approveUnLimit: false }),
  useSwapSlippagePercentageModeInfo: () => ({
    slippageItem: { key: 'auto', value: 0.5 },
  }),
}));

jest.mock('./useSwapTxHistory', () => ({
  useSwapTxHistoryActions: () => ({
    generateSwapHistoryItem: jest.fn(),
  }),
}));

function createQuote({
  fromToken = mockPayToken,
  protocol,
  toToken,
}: {
  fromToken?: ISwapToken;
  protocol: EProtocolOfExchange;
  toToken: ISwapToken;
}): IFetchQuoteResult {
  return {
    fromAmount: '100',
    fromTokenInfo: fromToken,
    info: { provider: 'provider-a', providerName: 'Provider A' },
    kind: ESwapQuoteKind.SELL,
    protocol,
    quoteResultCtx: {
      cowSwapUnSignedOrder: {
        appData: '0xapp-data',
        buyAmount: '1',
        buyTokenBalance: 'erc20',
        partiallyFillable: false,
        receiver: '0xreceiver',
        sellAmount: '100',
        sellTokenBalance: 'erc20',
        validTo: Math.floor(Date.now() / 1000) + 60 * 60,
      },
    },
    swapShouldSignedData: {
      unSignedInfo: {
        origin: 'OneKey',
        scope: 'swap',
        signedType: EMessageTypesEth.TYPED_DATA_V4,
      },
      unSignedMessage: '{"message":"sign me"}',
    },
    toAmount: '1',
    toTokenInfo: toToken,
  };
}

function createExecutionSnapshot({
  stockSide = 'to',
  swapType,
}: {
  stockSide?: 'from' | 'to';
  swapType: ESwapTabSwitchType;
}): ISwapExecutionSnapshot {
  const isStock = swapType === ESwapTabSwitchType.STOCK;
  const fromToken =
    isStock && stockSide === 'from' ? mockStockToken : mockPayToken;
  let toToken = mockSwapToken;
  if (isStock) {
    toToken = stockSide === 'from' ? mockPayToken : mockStockToken;
  }
  const quoteResult = createQuote({
    fromToken,
    protocol: isStock ? EProtocolOfExchange.STOCK : EProtocolOfExchange.SWAP,
    toToken,
  });
  return {
    accountId: 'account-a',
    dbAccountId: 'db-a',
    fromToken,
    fromTokenAmount: '100',
    indexedAccountId: 'indexed-a',
    kind: ESwapQuoteKind.SELL,
    limitSettings: {
      expirationTime: '3600',
      partiallyFillable: true,
      priceFromAmount: '',
      priceToAmount: '',
    },
    networkId: 'evm--1',
    provenance: isStock
      ? {
          executionFingerprint: 'stock-fingerprint-q1',
          quoteCommittedAt: Date.now(),
          quoteIntentRevision: 7,
          quoteRequestId: 'stock-request-q1',
        }
      : { executionFingerprint: 'swap-fingerprint' },
    provider: 'provider-a',
    quoteResult,
    receivingAddress: '0xsender',
    recipientMode: ESwapExecutionRecipientMode.Self,
    reviewRevision: 'review-q1',
    senderAddress: '0xsender',
    slippage: 0.5,
    swapType,
    toToken,
    toTokenAmount: '1',
  };
}

function createQuoteSession({
  intentRevision,
  phase,
  requestId,
}: {
  intentRevision: number;
  phase: ISwapQuoteSessionState['phase'];
  requestId?: string;
}): ISwapQuoteSessionState {
  return {
    activeSession: requestId
      ? {
          fingerprint: `fingerprint-${requestId}`,
          intentRevision,
          requestId,
          surfaceId: 'stock-surface',
        }
      : undefined,
    bgGeneration: requestId ? 1 : undefined,
    intentRevision,
    lastSequence: requestId ? 1 : 0,
    phase,
    surfaceId: 'stock-surface',
  };
}

function createExecutionValues(stepType: ESwapStepType) {
  const steps: ISwapStep[] = [
    { status: ESwapStepStatus.READY, type: stepType },
  ];
  const preSwapData: ISwapPreSwapData = {
    fromToken: mockExecutionSnapshot.fromToken,
    fromTokenAmount: mockExecutionSnapshot.fromTokenAmount,
    toToken: mockExecutionSnapshot.toToken,
    toTokenAmount: mockExecutionSnapshot.toTokenAmount,
  };
  mockSwapStepsState = {
    preSwapData,
    quoteResult: mockExecutionSnapshot.quoteResult,
    steps,
  };
  return {
    preSwapData,
    quoteResult: mockExecutionSnapshot.quoteResult,
    steps,
  };
}

function createDirectSendExecutionValues({
  gasAccount = false,
}: { gasAccount?: boolean } = {}) {
  const executionValues = createExecutionValues(ESwapStepType.SEND_TX);
  const quoteResult = mockExecutionSnapshot.quoteResult;
  const encodedTx = '0xencoded-stock-swap';
  const swapInfo: ISwapTxInfo = {
    accountAddress: mockExecutionSnapshot.senderAddress,
    protocol: quoteResult.protocol ?? EProtocolOfExchange.STOCK,
    receiver: {
      accountInfo: {
        accountId: 'account-a',
        networkId: quoteResult.toTokenInfo.networkId,
      },
      amount: quoteResult.toAmount ?? '1',
      token: quoteResult.toTokenInfo,
    },
    receivingAddress: mockExecutionSnapshot.receivingAddress,
    sender: {
      accountInfo: {
        accountId: 'account-a',
        networkId: quoteResult.fromTokenInfo.networkId,
      },
      amount: quoteResult.fromAmount ?? '100',
      token: quoteResult.fromTokenInfo,
    },
    swapBuildResData: {
      orderId: 'stock-order-a',
      result: quoteResult,
    },
  };
  const gasInfo: ISwapGasInfo = {
    common: {
      feeDecimals: 18,
      feeSymbol: 'ETH',
      nativeDecimals: 18,
      nativeSymbol: 'ETH',
      nativeTokenPrice: 1,
    },
    ...(gasAccount
      ? {
          gasAccountEligible: true,
          gasAccountQuote: {
            expiresAt: '2099-01-01T00:00:00.000Z',
            maxFee: '1',
            quoteId: 'gas-account-quote-a',
          },
          payer: 'gasAccount' as const,
        }
      : {}),
  };
  executionValues.preSwapData = {
    ...executionValues.preSwapData,
    netWorkFee: {
      gasInfos: [{ encodeTx: encodedTx, gasInfo }],
    },
    swapBuildResultData: {
      encodedTx,
      orderId: 'stock-order-a',
      skipSendTransAction: false,
      swapInfo,
    },
  };
  mockSwapStepsState = {
    ...executionValues,
    quoteResult,
  };
  const unsignedTx = { encodedTx, swapInfo };
  mockPrepareSendConfirmUnsignedTx.mockResolvedValue(unsignedTx);
  mockUpdateUnsignedTx.mockResolvedValue(unsignedTx);
  return executionValues;
}

describe('useSwapBuildTx Stock Review live execution lease', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecutionSnapshot = createExecutionSnapshot({
      swapType: ESwapTabSwitchType.STOCK,
    });
    mockQuoteSessionState = createQuoteSession({
      intentRevision: 7,
      phase: 'settled',
      requestId: 'stock-request-q1',
    });
    mockStockMarketQuoteGate = {
      ownerStockKey: mockStockOwnerKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    mockFromAccountId = 'account-a';
    mockFromNetworkId = 'evm--1';
    mockFromUserAddress = '0xsender';
    mockSwapStepsState = { preSwapData: {}, steps: [] };
    mockStepTransitions = [];
    mockFetchBuildTx.mockResolvedValue(undefined);
    mockFetchSwapTokenDetails.mockResolvedValue([]);
    mockSignMessage.mockResolvedValue('0xsigned');
    mockSignAndSendTransaction.mockResolvedValue({ txid: '0xtx' });
    mockPrepareSendConfirmUnsignedTx.mockResolvedValue({
      encodedTx: '0xencoded',
    });
    mockUpdateUnsignedTx.mockResolvedValue({ encodedTx: '0xencoded' });
    mockPrecheckUnsignedTxs.mockResolvedValue(undefined);
    mockVerifyTransaction.mockResolvedValue(undefined);
    mockBuildDecodedTx.mockResolvedValue({});
    mockSaveSendConfirmHistoryTxs.mockResolvedValue(undefined);
    mockGetVaultSettings.mockResolvedValue({});
    mockFetchMarketTokenDetail.mockResolvedValue({
      data: { token: { stock: { isOpen: true } } },
    });
    mockNavigationToTxConfirm.mockResolvedValue(undefined);
    mockSetSwapSteps.mockImplementation((update) => {
      mockSwapStepsState =
        typeof update === 'function'
          ? update(mockSwapStepsState)
          : mockSwapStepsState;
      const status = mockSwapStepsState.steps[0]?.status;
      if (status) {
        mockStepTransitions.push(status);
      }
    });
  });

  it.each([
    {
      name: 'the market becomes explicitly Closed',
      updateLiveLease: () => {
        mockStockMarketQuoteGate = {
          ownerStockKey: mockStockOwnerKey,
          status: ESwapStockMarketQuoteGateStatus.Closed,
        };
        mockQuoteSessionState = createQuoteSession({
          intentRevision: 8,
          phase: 'cancelled',
        });
      },
    },
    {
      name: 'the Q1 session is superseded by Q2',
      updateLiveLease: () => {
        mockQuoteSessionState = createQuoteSession({
          intentRevision: 8,
          phase: 'streaming',
          requestId: 'stock-request-q2',
        });
      },
    },
  ])(
    'blocks a saved Q1 callback before loading or IO when $name',
    async ({ updateLiveLease }) => {
      const { result, rerender } = renderHook(() => useSwapBuildTx());
      const savedQ1Callback = result.current.preSwapStepsStart;

      updateLiveLease();
      rerender();

      await act(async () => {
        await savedQ1Callback(
          createExecutionValues(ESwapStepType.SIGN_MESSAGE),
        );
      });

      expect(mockStepTransitions).not.toContain(ESwapStepStatus.LOADING);
      expect(mockFetchBuildTx).not.toHaveBeenCalled();
      expect(mockSignMessage).not.toHaveBeenCalled();
      expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
    },
  );

  it('does not apply the Stock live lease to a saved ordinary Swap callback', async () => {
    mockExecutionSnapshot = createExecutionSnapshot({
      swapType: ESwapTabSwitchType.SWAP,
    });
    const { result, rerender } = renderHook(() => useSwapBuildTx());
    const savedSwapCallback = result.current.preSwapStepsStart;

    mockStockMarketQuoteGate = {
      ownerStockKey: mockStockOwnerKey,
      status: ESwapStockMarketQuoteGateStatus.Closed,
    };
    mockQuoteSessionState = createQuoteSession({
      intentRevision: 8,
      phase: 'cancelled',
    });
    rerender();

    await act(async () => {
      await savedSwapCallback(
        createExecutionValues(ESwapStepType.SIGN_MESSAGE),
      );
    });

    expect(mockStepTransitions).toContain(ESwapStepStatus.LOADING);
    expect(mockSignMessage).toHaveBeenCalledTimes(1);
    expect(mockFetchMarketTokenDetail).not.toHaveBeenCalled();
    expect(mockFetchBuildTx).toHaveBeenCalledTimes(1);
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('checks the market exactly once at a direct Stock message-sign boundary', async () => {
    const { result } = renderHook(() => useSwapBuildTx());

    await act(async () => {
      await result.current.preSwapStepsStart(
        createExecutionValues(ESwapStepType.SIGN_MESSAGE),
      );
    });

    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);
    expect(mockSignMessage).toHaveBeenCalledTimes(1);
    expect(mockFetchMarketTokenDetail.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignMessage.mock.invocationCallOrder[0],
    );
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('uses the from-side Stock owner and blocks a closed SELL before message signing', async () => {
    mockExecutionSnapshot = createExecutionSnapshot({
      stockSide: 'from',
      swapType: ESwapTabSwitchType.STOCK,
    });
    mockStockMarketQuoteGate = {
      ownerStockKey: getSwapStockMarketQuoteOwnerKey({
        fromToken: mockStockToken,
        toToken: mockPayToken,
      }),
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    mockFetchMarketTokenDetail.mockResolvedValueOnce({
      data: { token: { stock: { isOpen: false } } },
    });
    const { result } = renderHook(() => useSwapBuildTx());

    await act(async () => {
      await result.current.preSwapStepsStart(
        createExecutionValues(ESwapStepType.SIGN_MESSAGE),
      );
    });

    expect(mockFetchMarketTokenDetail).toHaveBeenCalledWith(
      mockStockToken.contractAddress,
      mockStockToken.networkId,
      { autoHandleError: false },
    );
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);
    expect(mockSignMessage).not.toHaveBeenCalled();
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('blocks a saved Stock continuation after its execution snapshot is cleared', async () => {
    const { result, rerender } = renderHook(() => useSwapBuildTx());
    const savedStockCallback = result.current.preSwapStepsStart;
    const executionValues = createExecutionValues(ESwapStepType.SIGN_MESSAGE);

    mockExecutionSnapshot = undefined as unknown as ISwapExecutionSnapshot;
    rerender();

    await act(async () => {
      await savedStockCallback(executionValues);
    });

    expect(mockStepTransitions).not.toContain(ESwapStepStatus.LOADING);
    expect(mockFetchBuildTx).not.toHaveBeenCalled();
    expect(mockFetchMarketTokenDetail).not.toHaveBeenCalled();
    expect(mockSignMessage).not.toHaveBeenCalled();
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('does not let a saved Q1 continuation inherit a newer Q2 snapshot revision', async () => {
    const { result, rerender } = renderHook(() => useSwapBuildTx());
    const savedQ1Callback = result.current.preSwapStepsStart;
    const q1ExecutionValues = createExecutionValues(ESwapStepType.SIGN_MESSAGE);

    mockExecutionSnapshot = {
      ...createExecutionSnapshot({ swapType: ESwapTabSwitchType.STOCK }),
      provenance: {
        executionFingerprint: 'stock-fingerprint-q2',
        quoteCommittedAt: Date.now(),
        quoteIntentRevision: 8,
        quoteRequestId: 'stock-request-q2',
      },
      reviewRevision: 'review-q2',
    };
    mockQuoteSessionState = createQuoteSession({
      intentRevision: 8,
      phase: 'settled',
      requestId: 'stock-request-q2',
    });
    rerender();

    await act(async () => {
      await savedQ1Callback(q1ExecutionValues);
    });

    expect(mockStepTransitions).not.toContain(ESwapStepStatus.LOADING);
    expect(mockFetchBuildTx).not.toHaveBeenCalled();
    expect(mockFetchMarketTokenDetail).not.toHaveBeenCalled();
    expect(mockSignMessage).not.toHaveBeenCalled();
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('authoritatively blocks an explicitly closed market before direct Stock broadcast', async () => {
    const executionValues = createDirectSendExecutionValues();
    mockFetchMarketTokenDetail.mockResolvedValueOnce({
      data: { token: { stock: { isOpen: false } } },
    });
    const { result } = renderHook(() => useSwapBuildTx());

    await act(async () => {
      await result.current.preSwapStepsStart(executionValues);
    });

    expect(mockFetchMarketTokenDetail).toHaveBeenCalledWith(
      mockStockToken.contractAddress,
      mockStockToken.networkId,
      { autoHandleError: false },
    );
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('uses the from-side Stock owner and blocks a closed SELL before direct broadcast', async () => {
    mockExecutionSnapshot = createExecutionSnapshot({
      stockSide: 'from',
      swapType: ESwapTabSwitchType.STOCK,
    });
    mockStockMarketQuoteGate = {
      ownerStockKey: getSwapStockMarketQuoteOwnerKey({
        fromToken: mockStockToken,
        toToken: mockPayToken,
      }),
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    const executionValues = createDirectSendExecutionValues();
    mockFetchMarketTokenDetail.mockResolvedValueOnce({
      data: { token: { stock: { isOpen: false } } },
    });
    const { result } = renderHook(() => useSwapBuildTx());

    await act(async () => {
      await result.current.preSwapStepsStart(executionValues);
    });

    expect(mockFetchMarketTokenDetail).toHaveBeenCalledWith(
      mockStockToken.contractAddress,
      mockStockToken.networkId,
      { autoHandleError: false },
    );
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('keeps the x fail-open behavior when the direct Stock market check is unavailable', async () => {
    const executionValues = createDirectSendExecutionValues();
    mockFetchMarketTokenDetail.mockRejectedValueOnce(
      new Error('market detail unavailable'),
    );
    const { result } = renderHook(() => useSwapBuildTx());

    await act(async () => {
      await result.current.preSwapStepsStart(executionValues);
    });

    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
    expect(mockFetchMarketTokenDetail.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignAndSendTransaction.mock.invocationCallOrder[0],
    );
  });

  it('rechecks the market before a gas-account fallback retries direct Stock broadcast', async () => {
    const executionValues = createDirectSendExecutionValues({
      gasAccount: true,
    });
    mockFetchMarketTokenDetail
      .mockResolvedValueOnce({
        data: { token: { stock: { isOpen: true } } },
      })
      .mockResolvedValueOnce({
        data: { token: { stock: { isOpen: false } } },
      });
    mockSignAndSendTransaction.mockRejectedValueOnce(
      Object.assign(new Error('gas account pool exhausted'), {
        code: 40_213,
      }),
    );
    const { result } = renderHook(() => useSwapBuildTx());

    await act(async () => {
      await result.current.preSwapStepsStart(executionValues);
    });

    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(2);
    expect(mockSignAndSendTransaction).toHaveBeenCalledTimes(1);
  });

  it('rechecks the local lease after the async direct Stock market check settles', async () => {
    const executionValues = createDirectSendExecutionValues();
    let resolveMarketDetail!: (value: unknown) => void;
    mockFetchMarketTokenDetail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMarketDetail = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => useSwapBuildTx());

    let executionPromise!: Promise<void>;
    act(() => {
      executionPromise = result.current.preSwapStepsStart(executionValues);
    });
    await waitFor(() => {
      expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);
    });

    mockFromAccountId = 'account-b';
    rerender();
    resolveMarketDetail({
      data: { token: { stock: { isOpen: true } } },
    });
    await act(async () => {
      await executionPromise;
    });

    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('hands the live Stock lease to a fallback TxConfirm submit', async () => {
    mockExecutionSnapshot = {
      ...mockExecutionSnapshot,
      quoteResult: {
        ...mockExecutionSnapshot.quoteResult,
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '100',
        },
      },
    };
    const { result, rerender } = renderHook(() => useSwapBuildTx());
    const executionValues = createExecutionValues(ESwapStepType.APPROVE_TX);
    executionValues.preSwapData = {
      ...executionValues.preSwapData,
      shouldFallback: true,
    };

    await act(async () => {
      await result.current.preSwapStepsStart(executionValues);
    });

    expect(mockNavigationToTxConfirm).toHaveBeenCalledTimes(1);
    const beforeConfirm =
      mockNavigationToTxConfirm.mock.calls[0][0].beforeConfirm;
    expect(beforeConfirm).toEqual(expect.any(Function));
    await expect(
      Promise.resolve().then(() => beforeConfirm?.('submit')),
    ).resolves.toBeUndefined();
    expect(mockFetchMarketTokenDetail).not.toHaveBeenCalled();
    await expect(
      Promise.resolve().then(() => beforeConfirm?.('sign')),
    ).resolves.toBeUndefined();
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledWith(
      mockStockToken.contractAddress,
      mockStockToken.networkId,
      { autoHandleError: false },
    );
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);

    mockFromAccountId = 'account-b';
    rerender();
    await expect(
      Promise.resolve().then(() => beforeConfirm?.('submit')),
    ).rejects.toThrow('Swap signing account changed');

    mockFromAccountId = 'account-a';
    mockQuoteSessionState = createQuoteSession({
      intentRevision: 8,
      phase: 'streaming',
      requestId: 'stock-request-q2',
    });
    rerender();
    await expect(
      Promise.resolve().then(() => beforeConfirm?.('submit')),
    ).rejects.toThrow('swap_page.button_refresh_quotes');
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);

    mockStockMarketQuoteGate = {
      ownerStockKey: mockStockOwnerKey,
      status: ESwapStockMarketQuoteGateStatus.Closed,
    };
    mockQuoteSessionState = createQuoteSession({
      intentRevision: 8,
      phase: 'cancelled',
    });
    rerender();

    await expect(
      Promise.resolve().then(() => beforeConfirm?.('submit')),
    ).rejects.toThrow('dexmarket.stock_status_closed_error');

    mockStockMarketQuoteGate = {
      ownerStockKey: mockStockOwnerKey,
      status: ESwapStockMarketQuoteGateStatus.Allowed,
    };
    mockQuoteSessionState = createQuoteSession({
      intentRevision: 7,
      phase: 'settled',
      requestId: 'stock-request-q1',
    });
    mockExecutionSnapshot = undefined as unknown as ISwapExecutionSnapshot;
    rerender();
    await expect(
      Promise.resolve().then(() => beforeConfirm?.('submit')),
    ).rejects.toThrow('swap_page.button_refresh_quotes');
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('blocks only an explicit live market close at the TxConfirm boundary', async () => {
    mockExecutionSnapshot = {
      ...mockExecutionSnapshot,
      quoteResult: {
        ...mockExecutionSnapshot.quoteResult,
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '100',
        },
      },
    };
    const { result } = renderHook(() => useSwapBuildTx());
    const executionValues = createExecutionValues(ESwapStepType.APPROVE_TX);
    executionValues.preSwapData = {
      ...executionValues.preSwapData,
      shouldFallback: true,
    };
    await act(async () => {
      await result.current.preSwapStepsStart(executionValues);
    });
    const beforeConfirm =
      mockNavigationToTxConfirm.mock.calls[0][0].beforeConfirm;

    mockFetchMarketTokenDetail.mockResolvedValueOnce({
      data: { token: { stock: { isOpen: false } } },
    });
    await expect(
      Promise.resolve().then(() => beforeConfirm?.('sign')),
    ).rejects.toThrow('dexmarket.stock_status_closed_error');

    mockFetchMarketTokenDetail.mockRejectedValueOnce(
      new Error('market detail unavailable'),
    );
    await expect(
      Promise.resolve().then(() => beforeConfirm?.('sign')),
    ).resolves.toBeUndefined();
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });

  it('rechecks the live signer after the async final market check settles', async () => {
    mockExecutionSnapshot = {
      ...mockExecutionSnapshot,
      quoteResult: {
        ...mockExecutionSnapshot.quoteResult,
        allowanceResult: {
          allowanceTarget: '0xspender',
          amount: '100',
        },
      },
    };
    let resolveMarketDetail!: (value: unknown) => void;
    mockFetchMarketTokenDetail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveMarketDetail = resolve;
        }),
    );
    const { result, rerender } = renderHook(() => useSwapBuildTx());
    const executionValues = createExecutionValues(ESwapStepType.APPROVE_TX);
    executionValues.preSwapData = {
      ...executionValues.preSwapData,
      shouldFallback: true,
    };
    await act(async () => {
      await result.current.preSwapStepsStart(executionValues);
    });
    const beforeConfirm =
      mockNavigationToTxConfirm.mock.calls[0][0].beforeConfirm;

    let signPreflight!: Promise<void>;
    await act(async () => {
      signPreflight = Promise.resolve().then(() => beforeConfirm?.('sign'));
      await Promise.resolve();
    });
    expect(mockFetchMarketTokenDetail).toHaveBeenCalledTimes(1);

    mockFromAccountId = 'account-b';
    rerender();
    resolveMarketDetail({
      data: { token: { stock: { isOpen: true } } },
    });

    await expect(signPreflight).rejects.toThrow('Swap signing account changed');
    expect(mockSignAndSendTransaction).not.toHaveBeenCalled();
  });
});
