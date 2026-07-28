import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { getHomeDisplaySnapshotPartitionTag } from './homeDisplaySnapshotKeys';
import {
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotPortfolioDetails,
} from './homeDisplaySnapshotRepository.native';

import type { IHomeDisplaySnapshotPortfolioDetails } from './homeDisplaySnapshotTypes';

export function loadHomeDisplaySnapshotPortfolioDetailsForOwner({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): IHomeDisplaySnapshotPortfolioDetails | undefined {
  const startedAt = Date.now();
  const partitionTag = getHomeDisplaySnapshotPartitionTag(ownerScopeKey);
  const context = loadHomeDisplaySnapshotManifest({ ownerScopeKey });
  const details = context
    ? loadHomeDisplaySnapshotPortfolioDetails({ context })
    : undefined;
  defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
    stage: 'lazyChunk',
    outcome: details ? 'hit' : 'miss',
    partitionTag,
    elapsedMs: Date.now() - startedAt,
    recordCount:
      (details?.smallBalanceTokens.length ?? 0) +
      (details?.riskTokens.length ?? 0),
    requestedSourceIds: 'portfolioDetails',
    loadedSourceIds: details ? 'portfolioDetails' : '',
    generation: context?.manifest?.generation,
  });
  return details;
}
