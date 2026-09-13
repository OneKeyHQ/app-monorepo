import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IBorrowHistory } from '@onekeyhq/shared/types/staking';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import {
  type IBorrowAction,
  normalizeBorrowMarketAddress,
  parseBorrowTag,
} from '../../Staking/utils/utils';

export type IBorrowHistoryListItem = Omit<
  IBorrowHistory['list'][number],
  'type'
> & {
  // Local history also contains metadata-only borrow actions such as
  // setCollateral, which the remote history response does not expose.
  type: IBorrowAction;
};

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
  // Keep cancellation metadata on the local transaction for pending-state
  // guards, but do not render the replacement itself as a borrow action.
  if (tx.replacedType === EReplaceTxType.Cancel) {
    return undefined;
  }

  const providerName = provider.toLowerCase();
  const parsedTags = (tx.stakingInfo?.tags ?? [])
    .map((tag) => parseBorrowTag(tag))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag))
    .filter((tag) => tag.provider === providerName);

  if (parsedTags.length === 0) {
    return undefined;
  }

  const collateralTags = parsedTags.filter(
    (tag) => tag.action === 'setCollateral',
  );
  if (collateralTags.length === 0) {
    return undefined;
  }

  // New transactions carry both a legacy provider tag and a scoped tag. If a
  // scoped tag is present, only show the transaction in its own market.
  const scopedCollateralTags = collateralTags.filter(
    (tag) => tag.setCollateralScope,
  );
  if (scopedCollateralTags.length === 0) {
    // Keep older transactions visible because they predate market-scoped tags.
    return 'setCollateral';
  }

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
