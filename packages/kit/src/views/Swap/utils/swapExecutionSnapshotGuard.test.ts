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
  assertSwapExecutionSignerMatches,
  isSwapExecutionRevisionCurrent,
  resolveSwapExecutionValues,
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
});
