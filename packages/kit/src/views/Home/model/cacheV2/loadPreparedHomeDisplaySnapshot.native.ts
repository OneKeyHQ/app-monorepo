import BigNumber from 'bignumber.js';

import { readHomeBannerStorePayload } from '../sections/banner/homeBannerStoreModel';

import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository.native';

import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';
import type { IHomeShellSemanticModel } from '../semantic/homeSemanticTypes';
import type { IHomeCachedSourceRecord } from '../store/homeStoreTypes';

export type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

const FUNDED_ACTIONS = ['send', 'receive', 'buySell', 'swap'] as const;
const ZERO_ACTIONS = ['addMoney', 'receive', 'more'] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function createShellFromPortfolioRecord(
  records: readonly IHomeCachedSourceRecord[],
): IHomeShellSemanticModel | undefined {
  const portfolioRecord = records.find(
    (record) => record.sourceId === 'portfolio',
  );
  if (
    !portfolioRecord ||
    !isObject(portfolioRecord.payload) ||
    !isObject(portfolioRecord.payload.payload)
  ) {
    return undefined;
  }
  const portfolioPayload = portfolioRecord.payload.payload;
  const amount = portfolioPayload.accountTokensValue;
  const currency =
    portfolioPayload.accountTokensWorthCurrency ??
    portfolioRecord.quoteBasis?.currency;
  if (
    typeof amount !== 'string' ||
    typeof currency !== 'string' ||
    currency.length === 0
  ) {
    return undefined;
  }
  const parsedAmount = new BigNumber(amount);
  if (!parsedAmount.isFinite() || parsedAmount.isNegative()) {
    return undefined;
  }
  if (parsedAmount.isZero()) {
    return {
      kind: 'portfolio',
      presentation: {
        kind: 'zero',
        header: {
          kind: 'zero',
          balance: { amount, currency },
        },
        actions: { kind: 'zero', items: ZERO_ACTIONS },
        banner: { kind: 'none' },
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
    };
  }
  const bannerRecord = records.find((record) => record.sourceId === 'banner');
  const bannerPayload = readHomeBannerStorePayload(bannerRecord?.payload);
  const hasBannerContent = Boolean(
    bannerPayload &&
    (bannerPayload.banners.length > 0 || bannerPayload.tronResource),
  );
  return {
    kind: 'portfolio',
    presentation: {
      kind: 'funded',
      header: {
        kind: 'funded',
        authority: 'confirmedCache',
        balance: { amount, currency },
      },
      actions: { kind: 'funded', items: FUNDED_ACTIONS },
      banner: hasBannerContent ? { kind: 'positive' } : { kind: 'none' },
      freshness: 'confirmedCache',
      refresh: 'refreshing',
    },
  };
}

export function loadPreparedHomeDisplaySnapshot({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): IPreparedHomeDisplaySnapshot | undefined {
  const context = loadHomeDisplaySnapshotManifest({ ownerScopeKey });
  if (!context) {
    return undefined;
  }
  const critical = loadHomeDisplaySnapshotCritical({ context });
  if (critical?.shell?.kind === 'loading') {
    return undefined;
  }
  const records = loadHomeDisplaySnapshotSourceRecords({
    context,
    sourceIds: ['banner', 'portfolio'],
  });
  const hasPortfolioRecord = records.some(
    (record) => record.sourceId === 'portfolio',
  );
  const shell = critical?.shell ?? createShellFromPortfolioRecord(records);
  if (!shell || (shell.kind === 'portfolio' && !hasPortfolioRecord)) {
    return undefined;
  }
  return {
    navigation: critical?.navigation,
    records,
    shell,
  };
}
