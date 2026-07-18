import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapQuoteKind,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapQuoteSessionPhase,
  type ISwapQuoteSessionState,
  invalidateSwapQuoteSession,
} from '../../../states/jotai/contexts/swap/quoteSessionV2';
import { ESwapStockMarketQuoteGateStatus } from '../../../states/jotai/contexts/swap/stockMarketQuoteGate';

import {
  SWAP_STOCK_EXECUTION_QUOTE_MAX_AGE_MS,
  assertSwapExecutionSignerMatches,
  isSwapExecutionRevisionCurrent,
  resolveSwapExecutionValues,
  resolveSwapReviewExecutionGuardState,
  resolveSwapReviewRiskCheckInput,
} from './swapExecutionSnapshotGuard';
import {
  ESwapExecutionRecipientMode,
  type ISwapExecutionSnapshot,
} from './swapReviewState';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xfrom',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};
const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xto',
  symbol: 'USDC',
  decimals: 6,
};
const quoteResult: IFetchQuoteResult = {
  protocol: EProtocolOfExchange.SWAP,
  kind: ESwapQuoteKind.SELL,
  info: { provider: 'provider-a', providerName: 'Provider A' },
  fromTokenInfo: fromToken,
  toTokenInfo: toToken,
  fromAmount: '1',
  toAmount: '2000',
};
const stockToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xstock',
  symbol: 'STOCK',
  decimals: 18,
  isStock: true,
};

const stockQuoteResult: IFetchQuoteResult = {
  protocol: EProtocolOfExchange.STOCK,
  kind: ESwapQuoteKind.SELL,
  info: { provider: 'stock-provider', providerName: 'Stock Provider' },
  fromTokenInfo: toToken,
  toTokenInfo: stockToken,
  fromAmount: '100',
  toAmount: '0.5',
};

const STOCK_OWNER_KEY = 'evm--1:0xstock:token';
const STOCK_QUOTE_REQUEST_ID = 'stock-request-1';
const STOCK_QUOTE_INTENT_REVISION = 7;

function createSnapshot(
  overrides: Partial<ISwapExecutionSnapshot> = {},
): ISwapExecutionSnapshot {
  return {
    reviewRevision: 'review-1',
    accountId: 'account-a',
    indexedAccountId: 'indexed-a',
    dbAccountId: 'db-a',
    networkId: 'evm--1',
    senderAddress: '0xAbC',
    receivingAccountId: 'account-recipient-a',
    receivingAddress: '0xReceiverA',
    recipientMode: ESwapExecutionRecipientMode.Account,
    swapType: ESwapTabSwitchType.SWAP,
    kind: ESwapQuoteKind.SELL,
    fromToken,
    toToken,
    fromTokenAmount: '1',
    toTokenAmount: '2000',
    provider: 'provider-a',
    slippage: 0.5,
    quoteResult,
    limitSettings: {
      expirationTime: '3600',
      priceFromAmount: '',
      priceToAmount: '',
      partiallyFillable: true,
    },
    provenance: { executionFingerprint: 'fingerprint-a' },
    ...overrides,
  };
}

function createStockSnapshot(
  overrides: Partial<ISwapExecutionSnapshot> = {},
): ISwapExecutionSnapshot {
  return createSnapshot({
    swapType: ESwapTabSwitchType.STOCK,
    fromToken: toToken,
    toToken: stockToken,
    fromTokenAmount: '100',
    toTokenAmount: '0.5',
    provider: 'stock-provider',
    quoteResult: stockQuoteResult,
    provenance: {
      executionFingerprint: 'stock-execution-fingerprint',
      quoteRequestId: STOCK_QUOTE_REQUEST_ID,
      quoteIntentRevision: STOCK_QUOTE_INTENT_REVISION,
      quoteCommittedAt: Date.now(),
    },
    ...overrides,
  });
}

function createStockQuoteSessionState({
  phase = 'settled',
  requestId = STOCK_QUOTE_REQUEST_ID,
  sessionIntentRevision = STOCK_QUOTE_INTENT_REVISION,
  stateIntentRevision = STOCK_QUOTE_INTENT_REVISION,
}: {
  phase?: ISwapQuoteSessionPhase;
  requestId?: string;
  sessionIntentRevision?: number;
  stateIntentRevision?: number;
} = {}): ISwapQuoteSessionState {
  return {
    surfaceId: 'stock-surface',
    intentRevision: stateIntentRevision,
    activeSession: {
      surfaceId: 'stock-surface',
      requestId,
      fingerprint: 'stock-quote-fingerprint',
      intentRevision: sessionIntentRevision,
    },
    bgGeneration: 1,
    lastSequence: 1,
    phase,
  };
}

const allowedStockMarketQuoteGate = {
  ownerStockKey: STOCK_OWNER_KEY,
  status: ESwapStockMarketQuoteGateStatus.Allowed,
};

describe('swapExecutionSnapshotGuard', () => {
  it('keeps account, recipient, quote, and slippage frozen when live state changes', () => {
    const snapshot = createSnapshot();
    const resolved = resolveSwapExecutionValues({
      snapshot,
      live: {
        accountId: 'account-b',
        networkId: 'evm--10',
        senderAddress: '0xSenderB',
        receivingAccountId: 'account-recipient-b',
        receivingAddress: '0xReceiverB',
        swapType: ESwapTabSwitchType.LIMIT,
        fromToken: toToken,
        toToken: fromToken,
        quoteResult: { ...quoteResult, toAmount: '999' },
        slippage: 9,
        limitSettings: {
          expirationTime: '1',
          priceFromAmount: '9',
          priceToAmount: '99',
          partiallyFillable: false,
        },
      },
    });

    expect(resolved).toMatchObject({
      accountId: 'account-a',
      networkId: 'evm--1',
      receivingAccountId: 'account-recipient-a',
      receivingAddress: '0xReceiverA',
      slippage: 0.5,
      quoteResult,
      limitSettings: snapshot.limitSettings,
    });
  });

  it('accepts EVM address casing but fails closed for a changed account', () => {
    const snapshot = createSnapshot();

    expect(() =>
      assertSwapExecutionSignerMatches({
        snapshot,
        currentAccountId: 'account-a',
        currentNetworkId: 'evm--1',
        currentSenderAddress: '0xabc',
      }),
    ).not.toThrow();
    expect(() =>
      assertSwapExecutionSignerMatches({
        snapshot,
        currentAccountId: 'account-b',
        currentNetworkId: 'evm--1',
        currentSenderAddress: '0xabc',
      }),
    ).toThrow('Swap signing account changed');
  });

  it('treats non-EVM address casing as signer identity', () => {
    const snapshot = createSnapshot({
      networkId: 'sol--101',
      senderAddress: 'AbCd',
    });

    expect(() =>
      assertSwapExecutionSignerMatches({
        snapshot,
        currentAccountId: 'account-a',
        currentNetworkId: 'sol--101',
        currentSenderAddress: 'abcd',
      }),
    ).toThrow('Swap signing account changed');
  });

  it('drops an async result when the review revision changes or clears', () => {
    const snapshot = createSnapshot();
    expect(
      isSwapExecutionRevisionCurrent({
        expectedRevision: 'review-1',
        currentSnapshot: snapshot,
      }),
    ).toBe(true);
    expect(
      isSwapExecutionRevisionCurrent({
        expectedRevision: 'review-1',
        currentSnapshot: createSnapshot({ reviewRevision: 'review-2' }),
      }),
    ).toBe(false);
    expect(
      isSwapExecutionRevisionCurrent({
        expectedRevision: 'review-1',
        currentSnapshot: undefined,
      }),
    ).toBe(false);
  });

  it('keeps the deferred risk prompt bound to the reviewed quote', () => {
    const snapshot = createSnapshot({
      fromTokenAmount: '2',
      toTokenAmount: '4000',
      limitSettings: {
        expirationTime: '3600',
        rate: '2000',
        priceFromAmount: '2',
        priceToAmount: '4000',
        partiallyFillable: true,
      },
    });

    expect(resolveSwapReviewRiskCheckInput(snapshot)).toMatchObject({
      reviewRevision: 'review-1',
      quoteResult,
      fromTokenAmount: '2',
      toTokenAmount: '4000',
      limitRate: '2000',
      toTokenDecimals: 6,
    });
    expect(resolveSwapReviewRiskCheckInput(undefined)).toBeUndefined();
  });

  it('does not run a deferred fallback signer after revision changes', async () => {
    let currentSnapshot = createSnapshot();
    const expectedRevision = currentSnapshot.reviewRevision;
    let resolveDeferred: (() => void) | undefined;
    const deferred = new Promise<void>((resolve) => {
      resolveDeferred = resolve;
    });
    const fallbackSigner = jest.fn();
    const task = (async () => {
      await deferred;
      if (
        isSwapExecutionRevisionCurrent({
          expectedRevision,
          currentSnapshot,
        })
      ) {
        fallbackSigner();
      }
    })();

    currentSnapshot = createSnapshot({ reviewRevision: 'review-2' });
    resolveDeferred?.();
    await task;

    expect(fallbackSigner).not.toHaveBeenCalled();
  });

  describe('Stock Review live execution lease', () => {
    it.each<ISwapQuoteSessionPhase>(['streaming', 'settled'])(
      'allows an exact Allowed owner (Ready or MarketUnavailable) and matching %s quote session',
      (phase) => {
        expect(
          resolveSwapReviewExecutionGuardState({
            snapshot: createStockSnapshot(),
            stockMarketQuoteGate: allowedStockMarketQuoteGate,
            quoteSessionState: createStockQuoteSessionState({ phase }),
          }),
        ).toEqual({
          blocked: false,
          explicitClosed: false,
        });
      },
    );

    it('resolves the frozen Stock owner from the sell side as well', () => {
      const sellQuoteResult: IFetchQuoteResult = {
        ...stockQuoteResult,
        fromTokenInfo: stockToken,
        toTokenInfo: toToken,
        fromAmount: '0.5',
        toAmount: '100',
      };

      expect(
        resolveSwapReviewExecutionGuardState({
          snapshot: createStockSnapshot({
            fromToken: stockToken,
            toToken,
            fromTokenAmount: '0.5',
            toTokenAmount: '100',
            quoteResult: sellQuoteResult,
          }),
          stockMarketQuoteGate: allowedStockMarketQuoteGate,
          quoteSessionState: createStockQuoteSessionState(),
        }).blocked,
      ).toBe(false);
    });

    it.each([
      {
        name: 'explicit Closed',
        gate: {
          ownerStockKey: STOCK_OWNER_KEY,
          status: ESwapStockMarketQuoteGateStatus.Closed,
        },
        explicitClosed: true,
      },
      {
        name: 'Checking',
        gate: {
          ownerStockKey: STOCK_OWNER_KEY,
          status: ESwapStockMarketQuoteGateStatus.Checking,
        },
        explicitClosed: false,
      },
      {
        name: 'an Allowed gate owned by another Stock',
        gate: {
          ownerStockKey: 'evm--1:0xother-stock:token',
          status: ESwapStockMarketQuoteGateStatus.Allowed,
        },
        explicitClosed: false,
      },
    ])(
      'blocks $name before considering session provenance',
      ({ explicitClosed, gate }) => {
        expect(
          resolveSwapReviewExecutionGuardState({
            snapshot: createStockSnapshot(),
            stockMarketQuoteGate: gate,
            quoteSessionState: createStockQuoteSessionState(),
          }),
        ).toEqual({
          blocked: true,
          explicitClosed,
        });
      },
    );

    it.each([
      {
        name: 'requestId',
        quoteSessionState: createStockQuoteSessionState({
          requestId: 'stock-request-2',
        }),
      },
      {
        name: 'live state intentRevision',
        quoteSessionState: createStockQuoteSessionState({
          stateIntentRevision: STOCK_QUOTE_INTENT_REVISION + 1,
        }),
      },
      {
        name: 'active session intentRevision',
        quoteSessionState: createStockQuoteSessionState({
          sessionIntentRevision: STOCK_QUOTE_INTENT_REVISION + 1,
        }),
      },
    ])(
      'blocks an exact Allowed gate when $name does not match',
      ({ quoteSessionState }) => {
        expect(
          resolveSwapReviewExecutionGuardState({
            snapshot: createStockSnapshot(),
            stockMarketQuoteGate: allowedStockMarketQuoteGate,
            quoteSessionState,
          }).blocked,
        ).toBe(true);
      },
    );

    it.each([
      {
        name: 'quoteRequestId',
        provenance: {
          executionFingerprint: 'stock-execution-fingerprint',
          quoteIntentRevision: STOCK_QUOTE_INTENT_REVISION,
          quoteCommittedAt: Date.now(),
        },
      },
      {
        name: 'quoteIntentRevision',
        provenance: {
          executionFingerprint: 'stock-execution-fingerprint',
          quoteRequestId: STOCK_QUOTE_REQUEST_ID,
          quoteCommittedAt: Date.now(),
        },
      },
    ])('fails closed when Stock provenance omits $name', ({ provenance }) => {
      expect(
        resolveSwapReviewExecutionGuardState({
          snapshot: createStockSnapshot({ provenance }),
          stockMarketQuoteGate: allowedStockMarketQuoteGate,
          quoteSessionState: createStockQuoteSessionState(),
        }).blocked,
      ).toBe(true);
    });

    it('fails closed when Stock provenance omits its quote commit time', () => {
      expect(
        resolveSwapReviewExecutionGuardState({
          snapshot: createStockSnapshot({
            provenance: {
              executionFingerprint: 'stock-execution-fingerprint',
              quoteRequestId: STOCK_QUOTE_REQUEST_ID,
              quoteIntentRevision: STOCK_QUOTE_INTENT_REVISION,
            },
          }),
          stockMarketQuoteGate: allowedStockMarketQuoteGate,
          quoteSessionState: createStockQuoteSessionState(),
        }).blocked,
      ).toBe(true);
    });

    it('accepts the exact Stock quote-age boundary and blocks older or future quotes', () => {
      const now = 1_000_000;
      const resolveAt = (quoteCommittedAt: number) =>
        resolveSwapReviewExecutionGuardState({
          now,
          snapshot: createStockSnapshot({
            provenance: {
              executionFingerprint: 'stock-execution-fingerprint',
              quoteRequestId: STOCK_QUOTE_REQUEST_ID,
              quoteIntentRevision: STOCK_QUOTE_INTENT_REVISION,
              quoteCommittedAt,
            },
          }),
          stockMarketQuoteGate: allowedStockMarketQuoteGate,
          quoteSessionState: createStockQuoteSessionState(),
        });

      expect(
        resolveAt(now - SWAP_STOCK_EXECUTION_QUOTE_MAX_AGE_MS).blocked,
      ).toBe(false);
      expect(
        resolveAt(now - SWAP_STOCK_EXECUTION_QUOTE_MAX_AGE_MS - 1).blocked,
      ).toBe(true);
      expect(resolveAt(now + 1).blocked).toBe(true);
    });

    it.each<ISwapQuoteSessionPhase>([
      'idle',
      'preparing',
      'cancelled',
      'error',
    ])('blocks a matching session while its phase is %s', (phase) => {
      expect(
        resolveSwapReviewExecutionGuardState({
          snapshot: createStockSnapshot(),
          stockMarketQuoteGate: allowedStockMarketQuoteGate,
          quoteSessionState: createStockQuoteSessionState({ phase }),
        }).blocked,
      ).toBe(true);
    });

    it('does not revive a Q1 snapshot after Closed invalidation and a new Allowed Q2 session', () => {
      const q1Snapshot = createStockSnapshot();
      const q1Session = createStockQuoteSessionState();
      const invalidatedSession = invalidateSwapQuoteSession(q1Session);

      expect(
        resolveSwapReviewExecutionGuardState({
          snapshot: q1Snapshot,
          stockMarketQuoteGate: {
            ownerStockKey: STOCK_OWNER_KEY,
            status: ESwapStockMarketQuoteGateStatus.Closed,
          },
          quoteSessionState: invalidatedSession,
        }),
      ).toEqual({
        blocked: true,
        explicitClosed: true,
      });

      const q2RequestId = 'stock-request-2';
      const q2Session = createStockQuoteSessionState({
        requestId: q2RequestId,
        sessionIntentRevision: invalidatedSession.intentRevision,
        stateIntentRevision: invalidatedSession.intentRevision,
        phase: 'streaming',
      });
      expect(
        resolveSwapReviewExecutionGuardState({
          snapshot: q1Snapshot,
          stockMarketQuoteGate: allowedStockMarketQuoteGate,
          quoteSessionState: q2Session,
        }).blocked,
      ).toBe(true);

      expect(
        resolveSwapReviewExecutionGuardState({
          snapshot: createStockSnapshot({
            provenance: {
              executionFingerprint: 'stock-execution-fingerprint-q2',
              quoteRequestId: q2RequestId,
              quoteIntentRevision: invalidatedSession.intentRevision,
              quoteCommittedAt: Date.now(),
            },
          }),
          stockMarketQuoteGate: allowedStockMarketQuoteGate,
          quoteSessionState: q2Session,
        }).blocked,
      ).toBe(false);
    });

    it('bypasses market and quote-session liveness for a non-Stock snapshot', () => {
      expect(
        resolveSwapReviewExecutionGuardState({
          snapshot: createSnapshot({
            provenance: {
              executionFingerprint: 'ordinary-swap-fingerprint',
            },
          }),
          stockMarketQuoteGate: {
            ownerStockKey: STOCK_OWNER_KEY,
            status: ESwapStockMarketQuoteGateStatus.Closed,
          },
          quoteSessionState: invalidateSwapQuoteSession(
            createStockQuoteSessionState(),
          ),
        }),
      ).toEqual({
        blocked: false,
        explicitClosed: false,
      });
    });
  });
});
