import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ESwapTabSwitchType,
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import type {
  ISwapExecutionLimitSettings,
  ISwapExecutionSnapshot,
} from './swapReviewState';

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

function isSameExecutionAddress({
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
    isSameExecutionAddress({
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
