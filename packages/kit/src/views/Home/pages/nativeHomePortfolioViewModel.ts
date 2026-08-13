import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import type {
  INativeHomePortfolioDeFiTokensViewModel,
  INativeHomePortfolioItemViewModel,
  INativeHomePortfolioLowValueAssetsViewModel,
  INativeHomePortfolioManageTokensViewModel,
  INativeHomePortfolioRiskAssetsViewModel,
  INativeHomePortfolioViewModel,
} from '@onekeyhq/native-components';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import {
  formatBalance,
  formatDisplayNumber,
  formatPrice,
  formatPriceChange,
  formatValue,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IDisplayNumber } from '@onekeyhq/shared/src/utils/numberUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import {
  UNAVAILABLE_DISPLAY,
  displayFiatValueOrUnavailable,
  displayOrUnavailable,
  isValidNumberValue,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type { ITokenFiat } from '@onekeyhq/shared/types/token';

function flattenDisplayNumber(value: IDisplayNumber): string {
  const result = formatDisplayNumber(value);
  if (typeof result === 'string') return result;
  return result
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part.type === 'decimal') return part.value;
      return '0'.repeat(Math.max(part.value - 1, 0));
    })
    .join('');
}

function formatUnavailableAware(
  value: string | number,
  formatter: (rawValue: string) => IDisplayNumber,
): string {
  return value === UNAVAILABLE_DISPLAY
    ? UNAVAILABLE_DISPLAY
    : flattenDisplayNumber(formatter(String(value)));
}

export function buildNativeHomeFiatValueText({
  valueUsd,
  hideValue,
  currencyMap,
  targetCurrencyId,
  targetCurrencySymbol,
}: {
  valueUsd: string;
  hideValue: boolean;
  currencyMap: Record<string, ICurrencyItem>;
  targetCurrencyId: string;
  targetCurrencySymbol: string;
}): string {
  if (hideValue) return '****';
  const convertedValue = convertFiat({
    value: valueUsd,
    sourceCurrency: USD_CURRENCY_ID,
    targetCurrency: targetCurrencyId,
    currencyMap,
  });
  return flattenDisplayNumber(
    formatValue(convertedValue, { currency: targetCurrencySymbol }),
  );
}

export function buildNativeHomePortfolioItemViewModel({
  id,
  symbol,
  iconUrl,
  networkIconUrl,
  enabled,
  fiat,
  valuationSettled,
  hideValue,
  currencyMap,
  targetCurrencyId,
  targetCurrencySymbol,
}: {
  id: string;
  symbol: string;
  iconUrl: string;
  networkIconUrl: string;
  enabled: boolean;
  fiat: ITokenFiat | undefined;
  valuationSettled: boolean;
  hideValue: boolean;
  currencyMap: Record<string, ICurrencyItem>;
  targetCurrencyId: string;
  targetCurrencySymbol: string;
}): INativeHomePortfolioItemViewModel {
  const sourceCurrencyId = fiat?.currency ?? targetCurrencyId;
  const convertValue = (value: string | number) =>
    convertFiat({
      value,
      sourceCurrency: sourceCurrencyId,
      targetCurrency: targetCurrencyId,
      currencyMap,
    });

  const rawPrice = displayOrUnavailable(fiat?.price);
  const priceText = formatUnavailableAware(rawPrice, (value) =>
    formatPrice(convertValue(value), { currency: targetCurrencySymbol }),
  );

  const rawPriceChange = displayOrUnavailable(fiat?.price24h);
  const priceChangeText = formatUnavailableAware(rawPriceChange, (value) =>
    formatPriceChange(value, {
      showPlusMinusSigns: Number(value) !== 0,
    }),
  );
  let priceChangeDirection: INativeHomePortfolioItemViewModel['priceChangeDirection'] =
    'neutral';
  if (isValidNumberValue(fiat?.price24h) && fiat.price24h > 0) {
    priceChangeDirection = 'positive';
  } else if (isValidNumberValue(fiat?.price24h) && fiat.price24h < 0) {
    priceChangeDirection = 'negative';
  }

  const balanceParsed = tokenRebaseUtils.applyBalanceMultiplier({
    amount: fiat?.balanceParsed,
    balanceMultiplier: fiat?.balanceMultiplier,
  });
  const rawBalance = displayOrUnavailable(balanceParsed);
  const rawValue = displayFiatValueOrUnavailable(
    fiat?.fiatValue,
    balanceParsed,
  );

  let balanceText = '';
  let valueText = '';
  if (fiat) {
    balanceText = hideValue
      ? '****'
      : formatUnavailableAware(rawBalance, formatBalance);
    valueText = hideValue
      ? '****'
      : formatUnavailableAware(rawValue, (value) =>
          formatValue(convertValue(value), {
            currency: targetCurrencySymbol,
          }),
        );
  }

  return {
    id,
    symbol,
    iconUrl,
    networkIconUrl,
    priceText,
    priceChangeText,
    priceChangeDirection,
    balanceText,
    valueText,
    valuationState: fiat || valuationSettled ? 'ready' : 'loading',
    enabled,
  };
}

export function buildNativeHomePortfolioViewModel({
  ownerMatches,
  generation,
  sourceItemCount,
  items,
  title,
  emptyText,
  showMoreTitle,
  showLessTitle,
  initialVisibleItemCount,
  deFiTokensFilter,
  lowValueAssets,
  riskAssets,
  manageTokens,
}: {
  ownerMatches: boolean;
  generation: number;
  sourceItemCount: number;
  items: INativeHomePortfolioItemViewModel[];
  title: string;
  emptyText: string;
  showMoreTitle: string;
  showLessTitle: string;
  initialVisibleItemCount: number;
  deFiTokensFilter: INativeHomePortfolioDeFiTokensViewModel;
  lowValueAssets: INativeHomePortfolioLowValueAssetsViewModel;
  riskAssets: INativeHomePortfolioRiskAssetsViewModel;
  manageTokens: INativeHomePortfolioManageTokensViewModel;
}): INativeHomePortfolioViewModel {
  const structureReady = ownerMatches && generation >= 0;
  const metadataReady = sourceItemCount === 0 || items.length > 0;
  const visibleItems = structureReady ? items : [];

  let state: INativeHomePortfolioViewModel['state'] = 'initialLoading';
  if (structureReady && metadataReady) {
    state = visibleItems.length > 0 ? 'ready' : 'empty';
  }

  return {
    title,
    state,
    emptyText,
    showMoreTitle,
    showLessTitle,
    initialVisibleItemCount,
    items: visibleItems,
    deFiTokensFilter,
    lowValueAssets,
    riskAssets,
    manageTokens,
  };
}
