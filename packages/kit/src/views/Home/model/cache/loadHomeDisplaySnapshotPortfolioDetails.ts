import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { getHomeDisplaySnapshotPartitionTag } from './homeDisplaySnapshotKeys';
import {
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotPortfolioDetails,
} from './homeDisplaySnapshotRepository';

import type { IHomeDisplaySnapshotPortfolioDetails } from './homeDisplaySnapshotTypes';

export async function loadHomeDisplaySnapshotPortfolioDetailsForOwner({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): Promise<IHomeDisplaySnapshotPortfolioDetails | undefined> {
  const startedAt = Date.now();
  const partitionTag = getHomeDisplaySnapshotPartitionTag(ownerScopeKey);
  const context = await loadHomeDisplaySnapshotManifest({ ownerScopeKey });
  const details = context
    ? await loadHomeDisplaySnapshotPortfolioDetails({ context })
    : undefined;
  defaultLogger.wallet.homeSnapshotPerf.event({
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
