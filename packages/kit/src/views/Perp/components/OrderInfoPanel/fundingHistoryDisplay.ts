import BigNumber from 'bignumber.js';

import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IUserFunding } from '@onekeyhq/shared/types/hyperliquid';

export type IFundingHistorySide = 'long' | 'short' | 'none';
export type IFundingHistorySideFilter = 'all' | 'long' | 'short';

export type IFundingHistoryMarketOption = {
  coin: string;
  label: string;
};

export type IFundingHistoryExportRecord = {
  time: string;
  market: string;
  size: string;
  side: string;
  payment: string;
  rate: string;
};

const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function sanitizeFundingHistoryCsvText(value: string): string {
  return CSV_FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

export function getFundingHistorySide(signedSize: string): IFundingHistorySide {
  const size = new BigNumber(signedSize);
  if (!size.isFinite() || size.isZero()) {
    return 'none';
  }
  return size.gt(0) ? 'long' : 'short';
}

export function formatFundingHistoryRate(fundingRate: string): string {
  const percentage = new BigNumber(fundingRate).multipliedBy(100);
  if (!percentage.isFinite()) {
    return '--';
  }

  const absolutePercentage = percentage.abs();
  const decimalPlaces = absolutePercentage.lt(0.01) ? 6 : 4;
  return `${percentage.toFixed(decimalPlaces)}%`;
}

export function getFundingHistoryPaymentPresentation(payment: string) {
  const amount = new BigNumber(payment);
  if (!amount.isFinite() || amount.isZero()) {
    return {
      absoluteAmount: '0',
      color: '$text' as const,
      sign: '',
    };
  }

  return amount.gt(0)
    ? {
        absoluteAmount: amount.abs().toFixed(),
        color: '$green11' as const,
        sign: '+',
      }
    : {
        absoluteAmount: amount.abs().toFixed(),
        color: '$red11' as const,
        sign: '-',
      };
}

export function getFundingHistoryMarketOptions(
  records: IUserFunding[],
): IFundingHistoryMarketOption[] {
  const markets = new Map<string, IFundingHistoryMarketOption>();
  records.forEach((record) => {
    const { coin } = record.delta;
    if (!markets.has(coin)) {
      const { displayName, dexLabel } = parseDexCoin(coin);
      markets.set(coin, {
        coin,
        label: dexLabel ? `${displayName} (${dexLabel})` : displayName,
      });
    }
  });
  return Array.from(markets.values()).toSorted(
    (a, b) => a.label.localeCompare(b.label) || a.coin.localeCompare(b.coin),
  );
}

export function reconcileFundingHistoryMarketOptions({
  currentOptions,
  nextOptions,
}: {
  currentOptions: IFundingHistoryMarketOption[];
  nextOptions: IFundingHistoryMarketOption[];
}): IFundingHistoryMarketOption[] {
  const hasSameOptions =
    currentOptions.length === nextOptions.length &&
    currentOptions.every(
      (option, index) =>
        option.coin === nextOptions[index]?.coin &&
        option.label === nextOptions[index]?.label,
    );

  return hasSameOptions ? currentOptions : nextOptions;
}

export function searchFundingHistoryMarketOptions({
  options,
  searchText,
}: {
  options: IFundingHistoryMarketOption[];
  searchText: string;
}): IFundingHistoryMarketOption[] {
  const normalizedSearchText = searchText.trim().toLowerCase();
  if (!normalizedSearchText) {
    return options;
  }
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(normalizedSearchText) ||
      option.coin.toLowerCase().includes(normalizedSearchText),
  );
}

export function filterFundingHistoryRecords({
  records,
  sideFilter,
  marketFilter,
}: {
  records: IUserFunding[];
  sideFilter: IFundingHistorySideFilter;
  marketFilter: string | undefined;
}): IUserFunding[] {
  return records.filter((record) => {
    const matchesSide =
      sideFilter === 'all' ||
      getFundingHistorySide(record.delta.szi) === sideFilter;
    const matchesMarket =
      marketFilter === undefined || record.delta.coin === marketFilter;
    return matchesSide && matchesMarket;
  });
}

export function buildFundingHistoryExportRecords({
  records,
  sideFilter,
  marketFilter,
  longLabel,
  shortLabel,
}: {
  records: IUserFunding[];
  sideFilter: IFundingHistorySideFilter;
  marketFilter: string | undefined;
  longLabel: string;
  shortLabel: string;
}): IFundingHistoryExportRecord[] {
  return filterFundingHistoryRecords({ records, sideFilter, marketFilter })
    .toSorted((a, b) => b.time - a.time || b.hash.localeCompare(a.hash))
    .map((record) => {
      const { delta } = record;
      const { displayName, dexLabel } = parseDexCoin(delta.coin);
      const market = dexLabel ? `${displayName} (${dexLabel})` : displayName;
      const size = new BigNumber(delta.szi).abs();
      const payment = new BigNumber(delta.usdc);
      const side = getFundingHistorySide(delta.szi);
      let sideLabel = '--';
      if (side === 'long') {
        sideLabel = longLabel;
      } else if (side === 'short') {
        sideLabel = shortLabel;
      }

      return {
        time: new Date(record.time).toISOString(),
        market: sanitizeFundingHistoryCsvText(market),
        size: size.isFinite() ? size.toFixed() : delta.szi,
        side: sanitizeFundingHistoryCsvText(sideLabel),
        payment: payment.isFinite() ? payment.toFixed() : delta.usdc,
        rate: formatFundingHistoryRate(delta.fundingRate),
      };
    });
}
