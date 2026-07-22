import type { IHomePopularTradingPayload } from '@onekeyhq/kit/src/views/Home/components/PopularTrading/types';
import type { IHomeDeFiLegacyPayload } from '@onekeyhq/kit/src/views/Home/model/sections/defi/homeDeFiSourceAdapter';
import type { IHomeHistoryStorePayload } from '@onekeyhq/kit/src/views/Home/model/sections/history/homeHistorySourceAdapter';
import { getHomeMarketTokenRowId } from '@onekeyhq/kit/src/views/Home/model/sections/market/homeMarketSourceAdapter';
import {
  type IHomeNFTLegacyPayload,
  getHomeNFTItemRowId,
} from '@onekeyhq/kit/src/views/Home/model/sections/nft/homeNFTSourceAdapter';
import type { IHomePerpsLegacyPayload } from '@onekeyhq/kit/src/views/Home/model/sections/perps/homePerpsSourceAdapter';
import type { IHomeSpotLegacyPayload } from '@onekeyhq/kit/src/views/Home/model/sections/spot/homeSpotSourceAdapter';
import type { IHomeSectionSemanticModel } from '@onekeyhq/kit/src/views/Home/model/semantic/homeSemanticTypes';
import { HOME_SECTION_ACTION_IDS } from '@onekeyhq/kit/src/views/Home/model/store/homeStoreCommandIds';
import type {
  IHomeContainerSection,
  IHomeContainerTabId,
} from '@onekeyhq/native-components';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';

type IHomeNativePayloads = {
  portfolio?: IHomeSpotLegacyPayload;
  perps?: IHomePerpsLegacyPayload;
  defi?: IHomeDeFiLegacyPayload;
  nft?: IHomeNFTLegacyPayload;
  history?: IHomeHistoryStorePayload;
  market?: IHomePopularTradingPayload;
};

type IHomeNativeLabels = {
  loading: string;
  noData: string;
  popular: string;
  positions: string;
  tokens: string;
  unableToLoad: string;
};

function formatAmount(
  value: string | number | undefined,
  locale: string,
): string {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '--';
  }
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 6,
  }).format(number);
}

function formatCurrency(
  value: string | number | undefined,
  currency: string,
  locale: string,
): string {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '--';
  }
  return new Intl.NumberFormat(locale, {
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(number);
}

function getStateTitle(
  semantic: IHomeSectionSemanticModel,
  labels: IHomeNativeLabels,
): string {
  if (semantic.kind === 'error') {
    return labels.unableToLoad;
  }
  if (semantic.kind === 'loading') {
    return labels.loading;
  }
  return labels.noData;
}

function getPriceChangeColor(priceChange: number): string | undefined {
  if (!Number.isFinite(priceChange) || priceChange === 0) {
    return undefined;
  }
  return priceChange > 0 ? '#1F9D67' : '#D64545';
}

function buildStateSection({
  sectionId,
  semantic,
  labels,
}: {
  labels: IHomeNativeLabels;
  sectionId: IHomeContainerTabId;
  semantic: IHomeSectionSemanticModel;
}): IHomeContainerSection[] | undefined {
  if (semantic.kind === 'ready') {
    return undefined;
  }
  if (semantic.kind === 'hidden') {
    return [];
  }
  const isLoading = semantic.kind === 'loading';
  return [
    {
      id: `${sectionId}-state`,
      items: [
        {
          id: `${sectionId}-state-item`,
          renderer: isLoading ? 'loading' : 'empty',
          title: getStateTitle(semantic, labels),
          displayHeight: 360,
        },
      ],
    },
  ];
}

function buildPortfolioSections(
  payload: IHomeSpotLegacyPayload | undefined,
  labels: IHomeNativeLabels,
  locale: string,
): IHomeContainerSection[] {
  const tokens = payload?.tokens ?? [];
  return [
    {
      id: 'portfolio-assets',
      title: labels.tokens,
      items: tokens.map((token) => {
        const fiat = payload?.tokenListMap[token.$key];
        const priceChange = Number(fiat?.price24h);
        return {
          id: token.$key,
          renderer: 'asset' as const,
          title: token.symbol || token.name,
          subtitle: formatCurrency(
            fiat?.price,
            payload?.accountTokensWorthCurrency ?? 'USD',
            locale,
          ),
          subtitleDetail: Number.isFinite(priceChange)
            ? `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`
            : undefined,
          subtitleDetailColor: getPriceChangeColor(priceChange),
          value: formatAmount(fiat?.balanceParsed ?? fiat?.balance, locale),
          detail: formatCurrency(
            fiat?.fiatValue,
            payload?.accountTokensWorthCurrency ?? 'USD',
            locale,
          ),
          imageUrl: token.logoURI,
          actionId: HOME_SECTION_ACTION_IDS.openAsset,
        };
      }),
    },
  ];
}

function buildPerpsSections(
  payload: IHomePerpsLegacyPayload | undefined,
  labels: IHomeNativeLabels,
  locale: string,
): IHomeContainerSection[] {
  const holdings = payload?.view.holdings ?? [];
  const positions = payload?.view.positions ?? [];
  return [
    {
      id: 'perps-holdings',
      items: holdings.map((holding, index) => ({
        id: `holding:${holding.symbol}:${index}`,
        renderer: 'perps' as const,
        title: holding.displaySymbol,
        subtitle: formatAmount(holding.balance, locale),
        value: formatCurrency(holding.valueUsd, 'USD', locale),
        detail: formatCurrency(holding.pnlUsd, 'USD', locale),
        actionId: HOME_SECTION_ACTION_IDS.openPerps,
      })),
    },
    {
      id: 'perps-positions',
      title: labels.positions,
      items: positions.map((position, index) => ({
        id: `position:${position.coin}:${index}`,
        renderer: 'perps' as const,
        title: position.coin,
        subtitle: `${position.side} ${position.leverageValue}x`,
        value: formatAmount(position.sizeCoin, locale),
        detail: formatCurrency(position.pnlUsd, 'USD', locale),
        actionId: HOME_SECTION_ACTION_IDS.openPerps,
      })),
    },
  ].filter((section) => section.items.length > 0);
}

function buildDeFiSections(
  payload: IHomeDeFiLegacyPayload | undefined,
  labels: IHomeNativeLabels,
  locale: string,
): IHomeContainerSection[] {
  return [
    {
      id: 'defi-protocols',
      items: (payload?.protocols ?? []).map((protocol) => {
        const key = defiUtils.buildProtocolMapKey({
          networkId: protocol.networkId,
          protocol: protocol.protocol,
        });
        const summary = payload?.protocolMap[key];
        return {
          id: key,
          renderer: 'defi' as const,
          title: summary?.protocolName ?? protocol.protocol,
          subtitle: `${protocol.positions.length} ${labels.positions}`,
          value: formatCurrency(
            summary?.netWorth,
            payload?.currency ?? 'USD',
            locale,
          ),
          imageUrl: summary?.protocolLogo,
          showChevron: true,
          actionId: HOME_SECTION_ACTION_IDS.openDeFiProtocol,
        };
      }),
    },
  ];
}

function buildNFTSections(
  payload: IHomeNFTLegacyPayload | undefined,
): IHomeContainerSection[] {
  return [
    {
      id: 'nft-collectibles',
      layout: 'grid',
      items: (payload?.data ?? []).map((nft) => ({
        id: getHomeNFTItemRowId(nft),
        renderer: 'nft',
        title: nft.metadata?.name ?? '-',
        subtitle: nft.collectionName,
        value: nft.amount && nft.amount !== '1' ? `×${nft.amount}` : undefined,
        imageUrl: nft.metadata?.image,
        actionId: HOME_SECTION_ACTION_IDS.openNFT,
      })),
    },
  ];
}

function buildHistorySections(
  payload: IHomeHistoryStorePayload | undefined,
): IHomeContainerSection[] {
  return [
    {
      id: 'history-transactions',
      items: (payload?.data ?? []).map((history) => ({
        id: history.id,
        renderer: 'history',
        title: String(history.displayStatus ?? history.decodedTx.status),
        subtitle: history.decodedTx.networkId,
        actionId: HOME_SECTION_ACTION_IDS.openHistory,
      })),
    },
  ];
}

function buildMarketSections(
  payload: IHomePopularTradingPayload | undefined,
  labels: IHomeNativeLabels,
  locale: string,
): IHomeContainerSection[] {
  if (!payload?.rows.length) {
    return [];
  }
  return [
    {
      id: 'market-popular',
      title: labels.popular,
      layout: 'horizontal',
      items: payload.rows.slice(0, 8).map((token) => ({
        id: getHomeMarketTokenRowId(token),
        renderer: 'market',
        title: token.symbol,
        subtitle: formatCurrency(token.price, 'USD', locale),
        detail: `${
          token.priceChange24h > 0 ? '+' : ''
        }${token.priceChange24h.toFixed(2)}%`,
        imageUrl: token.logoUrl,
        actionId: HOME_SECTION_ACTION_IDS.openMarket,
      })),
    },
  ];
}

export function buildMobileNativeHomeSections({
  labels,
  locale,
  payloads,
  sectionId,
  semantic,
}: {
  labels: IHomeNativeLabels;
  locale: string;
  payloads: IHomeNativePayloads;
  sectionId: IHomeContainerTabId;
  semantic: IHomeSectionSemanticModel;
}): IHomeContainerSection[] {
  const state = buildStateSection({ labels, sectionId, semantic });
  if (state) {
    return state;
  }
  switch (sectionId) {
    case 'portfolio':
      return [
        ...buildPortfolioSections(payloads.portfolio, labels, locale),
        ...buildMarketSections(payloads.market, labels, locale),
      ];
    case 'perps':
      return buildPerpsSections(payloads.perps, labels, locale);
    case 'defi':
      return buildDeFiSections(payloads.defi, labels, locale);
    case 'nft':
      return buildNFTSections(payloads.nft);
    case 'history':
      return buildHistorySections(payloads.history);
    default:
      return [];
  }
}

export type { IHomeNativeLabels, IHomeNativePayloads };
