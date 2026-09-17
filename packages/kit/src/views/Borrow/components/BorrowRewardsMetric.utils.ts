import { EEarnLabels } from '@onekeyhq/shared/types/staking';

import {
  normalizeBorrowMarketAddress,
  parseBorrowTag,
} from '../../Staking/utils/utils';

export type IBorrowPendingClaimTx = {
  decodedTx: {
    accountId: string;
    networkId: string;
  };
  stakingInfo: {
    label: EEarnLabels;
    tags?: string[];
  };
};

export function getPendingBorrowClaimIds({
  pendingTxs,
  accountId,
  networkId,
  provider,
  marketAddress,
}: {
  pendingTxs: readonly IBorrowPendingClaimTx[];
  accountId: string;
  networkId: string;
  provider: string;
  marketAddress: string;
}): string[] {
  const normalizedProvider = provider.toLowerCase();
  const normalizedMarketAddress = normalizeBorrowMarketAddress({
    networkId,
    marketAddress,
  });

  return pendingTxs.flatMap((tx) => {
    if (
      tx.stakingInfo.label !== EEarnLabels.Claim ||
      tx.decodedTx.accountId !== accountId ||
      tx.decodedTx.networkId !== networkId
    ) {
      return [];
    }

    return (tx.stakingInfo.tags ?? []).flatMap((tag) => {
      const parsed = parseBorrowTag(tag);
      if (
        parsed?.action !== 'claim' ||
        parsed.provider !== normalizedProvider
      ) {
        return [];
      }
      // Legacy tags have no market scope, so retain their owner-scoped pending
      // state until those persisted transactions settle after an app upgrade.
      if (
        parsed.claimScope &&
        (parsed.claimScope.networkId !== networkId ||
          parsed.claimScope.marketAddress !== normalizedMarketAddress)
      ) {
        return [];
      }
      return parsed.claimIds ?? [];
    });
  });
}
