// cspell:ignore GSPC IXIC DJIA
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketBannerTokenPreview } from '@onekeyhq/shared/types/marketV2';

const MARKET_INDEX_LOGO_URLS = {
  sp500: 'https://uni.onekey-asset.com/static/stock/s-and-p-500.png',
  nasdaq: 'https://uni.onekey-asset.com/static/stock/nasdaq-composite.png',
  dow30: 'https://uni.onekey-asset.com/static/stock/dow-30.png',
} as const;

const MARKET_INDEX_DISPLAY_CONFIG: Record<
  string,
  { labelId: ETranslations; order: number; logoUrl: string }
> = {
  GSPC: {
    labelId: ETranslations.market_index_sp500__title,
    order: 0,
    logoUrl: MARKET_INDEX_LOGO_URLS.sp500,
  },
  SPX: {
    labelId: ETranslations.market_index_sp500__title,
    order: 0,
    logoUrl: MARKET_INDEX_LOGO_URLS.sp500,
  },
  IXIC: {
    labelId: ETranslations.market_index_nasdaq__title,
    order: 1,
    logoUrl: MARKET_INDEX_LOGO_URLS.nasdaq,
  },
  COMP: {
    labelId: ETranslations.market_index_nasdaq__title,
    order: 1,
    logoUrl: MARKET_INDEX_LOGO_URLS.nasdaq,
  },
  DJI: {
    labelId: ETranslations.market_index_dow30__title,
    order: 2,
    logoUrl: MARKET_INDEX_LOGO_URLS.dow30,
  },
  DJIA: {
    labelId: ETranslations.market_index_dow30__title,
    order: 2,
    logoUrl: MARKET_INDEX_LOGO_URLS.dow30,
  },
};

export function getMarketIndexDisplayConfig(token: IMarketBannerTokenPreview) {
  const symbol = token.symbol.trim().toUpperCase().replace(/^\^/, '');
  return MARKET_INDEX_DISPLAY_CONFIG[symbol];
}

export function getMarketIndexTokens(tokens: IMarketBannerTokenPreview[] = []) {
  return tokens
    .toSorted((left, right) => {
      const leftOrder = getMarketIndexDisplayConfig(left)?.order;
      const rightOrder = getMarketIndexDisplayConfig(right)?.order;
      return (
        (leftOrder ?? Number.MAX_SAFE_INTEGER) -
        (rightOrder ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .slice(0, 3);
}
