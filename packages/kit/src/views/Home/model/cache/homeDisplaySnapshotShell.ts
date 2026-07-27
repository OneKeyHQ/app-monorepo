import BigNumber from 'bignumber.js';

import { readHomeBannerStorePayload } from '../sections/banner/homeBannerStoreModel';

import type { IHomeShellSemanticModel } from '../semantic/homeSemanticTypes';
import type { IHomeCachedSourceRecord } from '../store/homeStoreTypes';

const FUNDED_ACTIONS = ['send', 'receive', 'buySell', 'swap'] as const;
const ZERO_ACTIONS = ['addMoney', 'receive', 'more'] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function createPortfolioShellFromSnapshotRecords(
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
    portfolioPayload.accountTokensValueAvailable !== true ||
    portfolioPayload.accountTokensValueComplete !== true ||
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
  const bannerRecord = records.find((record) => record.sourceId === 'banner');
  const bannerPayload = readHomeBannerStorePayload(bannerRecord?.payload);
  const hasBannerContent = Boolean(
    bannerPayload &&
    (bannerPayload.banners.length > 0 || bannerPayload.tronResource),
  );
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
        banner: hasBannerContent ? { kind: 'positive' } : { kind: 'none' },
        freshness: 'confirmedCache',
        refresh: 'refreshing',
      },
    };
  }
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

export function selectPreparedHomeDisplaySnapshotShell({
  criticalShell,
  records,
}: {
  criticalShell: IHomeShellSemanticModel | undefined;
  records: readonly IHomeCachedSourceRecord[];
}): IHomeShellSemanticModel | undefined {
  if (
    criticalShell?.kind === 'backupRequired' ||
    criticalShell?.kind === 'missingNetworkAccount'
  ) {
    return criticalShell;
  }
  const hasPortfolioRecord = records.some(
    (record) => record.sourceId === 'portfolio',
  );
  if (hasPortfolioRecord) {
    // The source record and its completeness flags are the authority for the
    // cached total. A critical projection may be older than the source chunk.
    return createPortfolioShellFromSnapshotRecords(records);
  }
  return undefined;
}
