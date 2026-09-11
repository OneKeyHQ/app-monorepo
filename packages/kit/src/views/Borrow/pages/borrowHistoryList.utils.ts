import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EBorrowActionsEnum,
  type IBorrowHistory,
} from '@onekeyhq/shared/types/staking';

import {
  type IBorrowAction,
  normalizeBorrowMarketAddress,
  parseBorrowTag,
} from '../../Staking/utils/utils';

export type IBorrowHistoryListItem = Omit<
  IBorrowHistory['list'][number],
  'type'
> & {
  // The API currently exposes only supply/withdraw/borrow/repay, while local
  // tracking also knows about actions such as setCollateral and setEMode.
  type: IBorrowAction;
};

export const BORROW_HISTORY_REMOTE_ACTIONS = new Set<IBorrowAction>([
  EBorrowActionsEnum.Supply,
  EBorrowActionsEnum.Withdraw,
  EBorrowActionsEnum.Borrow,
  EBorrowActionsEnum.Repay,
]);

export function getBorrowHistoryActionForLocalTx({
  tx,
  provider,
  networkId,
  marketAddress,
}: {
  tx: IAccountHistoryTx;
  provider: string;
  networkId: string;
  marketAddress: string;
}): IBorrowAction | undefined {
  const providerName = provider.toLowerCase();
  const parsedTags = (tx.stakingInfo?.tags ?? [])
    .map((tag) => parseBorrowTag(tag))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
    .filter((tag) => tag.provider === providerName);

  if (parsedTags.length === 0) {
    return undefined;
  }

  // A setCollateral transaction carries both a legacy provider-wide tag and
  // a scoped tag. Prefer the scoped form so a transaction from another Aave
  // market is not shown in this market's history.
  const collateralTags = parsedTags.filter(
    (tag) => tag.action === 'setCollateral',
  );
  if (collateralTags.length > 0) {
    const scopedCollateralTags = collateralTags.filter(
      (tag) => tag.setCollateralScope,
    );
    if (scopedCollateralTags.length > 0) {
      const normalizedMarketAddress = normalizeBorrowMarketAddress({
        networkId,
        marketAddress,
      });
      return scopedCollateralTags.some((tag) => {
        const scope = tag.setCollateralScope;
        return (
          scope?.networkId === networkId &&
          scope.marketAddress === normalizedMarketAddress
        );
      })
        ? 'setCollateral'
        : undefined;
    }
    return 'setCollateral';
  }

  const claimTags = parsedTags.filter((tag) => tag.action === 'claim');
  if (claimTags.length > 0) {
    // Scoped claim tags must match this market. Prefer the scoped form when a
    // transaction carries both a legacy and a scoped tag.
    const scopedClaimTags = claimTags.filter((tag) => tag.claimScope);
    if (scopedClaimTags.length > 0) {
      const normalizedMarketAddress = normalizeBorrowMarketAddress({
        networkId,
        marketAddress,
      });
      return scopedClaimTags.some((tag) => {
        const scope = tag.claimScope;
        return (
          scope?.networkId === networkId &&
          scope.marketAddress === normalizedMarketAddress
        );
      })
        ? 'claim'
        : undefined;
    }
    return 'claim';
  }

  return parsedTags[0]?.action;
}

export function buildBorrowHistoryListItemKey(item: IBorrowHistoryListItem) {
  return [
    item.networkId,
    item.txHash,
    item.type,
    item.tokenAddress,
    item.direction,
    item.amount,
    item.timestamp,
    item.title,
  ].join(':');
}
