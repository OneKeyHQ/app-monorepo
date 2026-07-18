import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  isSwapStockMarketQuoteBlocked,
  isSwapStockMarketQuoteClosed,
} from '../../../states/jotai/contexts/swap/stockMarketQuoteGate';

import type {
  ISwapExecutionLimitSettings,
  ISwapExecutionSnapshot,
} from './swapReviewState';
import type { ISwapQuoteSessionState } from '../../../states/jotai/contexts/swap/quoteSessionV2';
import type { ISwapStockMarketQuoteGate } from '../../../states/jotai/contexts/swap/stockMarketQuoteGate';

export type ISwapLiveExecutionValues = {
  accountId?: string;
  indexedAccountId?: string;
  dbAccountId?: string;
  networkId?: string;
  senderAddress?: string;
  receivingAccountId?: string;
  receivingAddress?: string;
  walletId?: string;
  walletType?: string;
  deriveType?: string;
  addressEncoding?: string;
  swapType: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  quoteResult?: IFetchQuoteResult;
  slippage: number;
  limitSettings: ISwapExecutionLimitSettings;
};

export function resolveSwapExecutionValues({
  snapshot,
  live,
}: {
  snapshot?: ISwapExecutionSnapshot;
  live: ISwapLiveExecutionValues;
}): ISwapLiveExecutionValues {
  if (!snapshot) {
    return live;
  }

  return {
    accountId: snapshot.accountId,
    indexedAccountId: snapshot.indexedAccountId,
    dbAccountId: snapshot.dbAccountId,
    networkId: snapshot.networkId,
    senderAddress: snapshot.senderAddress,
    receivingAccountId: snapshot.receivingAccountId,
    receivingAddress: snapshot.receivingAddress,
    walletId: snapshot.walletId,
    walletType: snapshot.walletType,
    deriveType: snapshot.deriveType,
    addressEncoding: snapshot.addressEncoding,
    swapType: snapshot.swapType,
    fromToken: snapshot.fromToken,
    toToken: snapshot.toToken,
    quoteResult: snapshot.quoteResult,
    slippage: snapshot.slippage,
    limitSettings: snapshot.limitSettings,
  };
}

export function isSameSwapExecutionAddress({
  networkId,
  left,
  right,
}: {
  networkId: string;
  left?: string;
  right?: string;
}) {
  if (!left || !right) {
    return left === right;
  }
  if (networkUtils.isEvmNetwork({ networkId })) {
    return equalsIgnoreCase(left, right);
  }
  return left === right;
}

export function assertSwapExecutionSignerMatches({
  snapshot,
  currentAccountId,
  currentNetworkId,
  currentSenderAddress,
}: {
  snapshot?: ISwapExecutionSnapshot;
  currentAccountId?: string;
  currentNetworkId?: string;
  currentSenderAddress?: string;
}) {
  if (!snapshot) {
    return;
  }

  const matches =
    snapshot.accountId === currentAccountId &&
    snapshot.networkId === currentNetworkId &&
    isSameSwapExecutionAddress({
      networkId: snapshot.networkId,
      left: snapshot.senderAddress,
      right: currentSenderAddress,
    });

  if (!matches) {
    throw new OneKeyLocalError(
      'Swap signing account changed. Close Review and try again.',
    );
  }
}

export function isSwapExecutionRevisionCurrent({
  expectedRevision,
  currentSnapshot,
}: {
  expectedRevision?: string;
  currentSnapshot?: ISwapExecutionSnapshot;
}) {
  return (
    expectedRevision === undefined ||
    expectedRevision === currentSnapshot?.reviewRevision
  );
}

export type ISwapReviewExecutionGuardState = Readonly<{
  blocked: boolean;
  explicitClosed: boolean;
}>;

// Stock quotes are refreshed every 15 seconds while the surface is active.
// Two refresh windows bound a frozen Review without changing ordinary Swap.
export const SWAP_STOCK_EXECUTION_QUOTE_MAX_AGE_MS = 30_000;

/**
 * Stock Review keeps its execution payload frozen, but its permission to use
 * that payload is a live lease. Both the market owner and the quote session
 * that produced the snapshot must still match when execution starts.
 */
export function resolveSwapReviewExecutionGuardState({
  now = Date.now(),
  quoteSessionState,
  snapshot,
  stockMarketQuoteGate,
}: {
  now?: number;
  quoteSessionState: ISwapQuoteSessionState;
  snapshot?: ISwapExecutionSnapshot;
  stockMarketQuoteGate?: ISwapStockMarketQuoteGate;
}): ISwapReviewExecutionGuardState {
  if (snapshot?.swapType !== ESwapTabSwitchType.STOCK) {
    return {
      blocked: false,
      explicitClosed: false,
    };
  }

  const marketGateInput = {
    fromToken: snapshot.fromToken,
    gate: stockMarketQuoteGate,
    toToken: snapshot.toToken,
  };
  const explicitClosed = isSwapStockMarketQuoteClosed(marketGateInput);
  if (isSwapStockMarketQuoteBlocked(marketGateInput)) {
    return {
      blocked: true,
      explicitClosed,
    };
  }

  const quoteCommittedAt = snapshot.provenance.quoteCommittedAt;
  const isFreshQuote = Boolean(
    typeof quoteCommittedAt === 'number' &&
    Number.isFinite(quoteCommittedAt) &&
    quoteCommittedAt <= now &&
    now - quoteCommittedAt <= SWAP_STOCK_EXECUTION_QUOTE_MAX_AGE_MS,
  );
  if (!isFreshQuote) {
    return {
      blocked: true,
      explicitClosed,
    };
  }

  const { quoteIntentRevision, quoteRequestId } = snapshot.provenance;
  const activeSession = quoteSessionState.activeSession;
  const isExecutableSessionPhase =
    quoteSessionState.phase === 'streaming' ||
    quoteSessionState.phase === 'settled';
  const isExactQuoteSession = Boolean(
    quoteRequestId &&
    quoteIntentRevision !== undefined &&
    activeSession?.requestId === quoteRequestId &&
    activeSession.intentRevision === quoteIntentRevision &&
    quoteSessionState.intentRevision === quoteIntentRevision,
  );

  return {
    blocked: !isExecutableSessionPhase || !isExactQuoteSession,
    explicitClosed,
  };
}

export function resolveSwapReviewRiskCheckInput(
  snapshot?: ISwapExecutionSnapshot,
) {
  if (!snapshot) {
    return undefined;
  }
  return {
    reviewRevision: snapshot.reviewRevision,
    quoteResult: snapshot.quoteResult,
    fromTokenAmount: snapshot.fromTokenAmount,
    toTokenAmount: snapshot.toTokenAmount,
    limitRate: snapshot.limitSettings.rate,
    toTokenDecimals: snapshot.toToken.decimals,
  };
}
