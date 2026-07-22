import BigNumber from 'bignumber.js';

import { getProtocolActionBadgeLabelIds } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import {
  buildAprRangeText,
  buildAprText,
  formatRewardText,
} from '@onekeyhq/kit/src/views/Earn/components/AprText.utils';
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
import { SHOW_NFT_AMOUNT_MAX } from '@onekeyhq/shared/src/consts/walletConsts';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import { buildAddressMapInfoKey } from '@onekeyhq/shared/src/utils/historyUtils';
import {
  type IFormatDisplayNumberPart,
  formatBalance,
  formatDisplayNumber,
  formatMarketCap,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';
import { sortTokensByFiatValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import { getDisplayedActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import {
  EOnChainHistoryTxType,
  type IAccountHistoryTx,
} from '@onekeyhq/shared/types/history';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import {
  EApproveType,
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
  type IDecodedTxActionAssetTransfer,
} from '@onekeyhq/shared/types/tx';

const HYPER_EVM_LOGO_URI =
  'https://uni.onekey-asset.com/static/chain/hyper-evm.png';
const VISIBLE_ROW_LIMIT = 6;

const MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS = {
  openManageToken: 'home.native.portfolio.assets.manageToken',
  toggleDeFiExpanded: 'home.native.defi.expanded.toggle',
  togglePortfolioAssetsExpanded: 'home.native.portfolio.assets.expanded.toggle',
  togglePortfolioDeFiExpanded: 'home.native.portfolio.defi.expanded.toggle',
} as const;

const MOBILE_NATIVE_HOME_MARKET_CATEGORY_ACTION_PREFIX =
  'home.native.market.category:';

const MOBILE_NATIVE_HOME_MARKET_ACTION_IDS = {
  addRecommended: 'home.native.market.recommended.add',
  toggleRecommended: 'home.native.market.recommended.toggle',
  toggleFavorite: 'home.native.market.favorite.toggle',
  viewMore: 'home.native.market.viewMore',
  viewMorePerps: 'home.native.market.viewMorePerps',
} as const;

type IHomeNativeMarketRecommendationState = {
  actionTitle: string;
  selectedRowIds: readonly string[];
};

type IHomeNativePayloads = {
  portfolio?: IHomeSpotLegacyPayload;
  perps?: IHomePerpsLegacyPayload;
  defi?: IHomeDeFiLegacyPayload;
  nft?: IHomeNFTLegacyPayload;
  history?: IHomeHistoryStorePayload;
  market?: IHomePopularTradingPayload;
};

type IHomeNativeLabels = {
  addTokenInstruction: string;
  addTokenLabel: string;
  approve: string;
  contract: string;
  earn: string;
  favoriteAdd: string;
  favoriteRemove: string;
  hotMarkets: string;
  loading: string;
  long: string;
  margin: string;
  market: string;
  noData: string;
  positions: string;
  receive: string;
  revokeApprove: (symbol: string) => string;
  send: string;
  short: string;
  showLess: string;
  showMore: string;
  statusFailed: string;
  statusPending: string;
  swap: string;
  tokens: string;
  unableToLoad: string;
  unlimited: string;
  viewMore: string;
};

type IHomeNativeExpandedState = {
  defi: boolean;
  portfolioAssets: boolean;
  portfolioDeFi: boolean;
};

function displayNumberToString(
  value: string | IFormatDisplayNumberPart[],
): string {
  if (typeof value === 'string') {
    return value;
  }
  return value
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }
      if (part.type === 'sub') {
        return String(part.value)
          .split('')
          .map((digit) => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)] ?? digit)
          .join('');
      }
      return part.value;
    })
    .join('');
}

function formatAmount(value: string | number | undefined): string {
  if (value === undefined || !new BigNumber(value).isFinite()) {
    return '--';
  }
  return displayNumberToString(
    formatDisplayNumber(formatBalance(String(value))),
  );
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
  if (number !== 0 && Math.abs(number) < 0.01) {
    return currency.toUpperCase() === 'USD'
      ? '< $0.01'
      : `< ${currency.toUpperCase()} 0.01`;
  }
  try {
    return new Intl.NumberFormat(locale, {
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: 'currency',
    }).format(number);
  } catch {
    return `${currency.toUpperCase()} ${number.toFixed(2)}`;
  }
}

function formatCompactCurrency(
  value: string | number | undefined,
  _locale: string,
): string | undefined {
  if (value === undefined || !new BigNumber(value).isFinite()) {
    return undefined;
  }
  return `$${displayNumberToString(
    formatDisplayNumber(formatMarketCap(String(value))),
  )}`;
}

function formatEarnApr(
  item: NonNullable<IHomePopularTradingPayload>['earnRows'][number],
): string {
  const rewardUnit = item.rewardUnit ?? 'APR';
  const range = buildAprRangeText({
    minAprInfo: item.minAprInfo,
    maxAprInfo: item.maxAprInfo,
    rewardUnit,
  });
  if (range) {
    return range;
  }
  const emphasized =
    item.aprInfo?.highlight?.text || item.aprInfo?.normal?.text;
  if (emphasized) {
    return formatRewardText({
      text: emphasized,
      rewardUnit,
      hideSuffix: false,
    });
  }
  return buildAprText(
    `${new BigNumber(item.aprWithoutFee || 0).toFixed(2)}%`,
    rewardUnit,
  );
}

function formatSectionDate(timestamp: number, locale: string): string {
  const date = new Date(
    timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp,
  );
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatTimestamp(timestamp: number, locale: string): string {
  const date = new Date(
    timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp,
  );
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
      items: isLoading
        ? Array.from({ length: 5 }, (_, index) => ({
            id: `${sectionId}-state-loading-${index}`,
            renderer: 'loading' as const,
            title: labels.loading,
            displayHeight: 68,
          }))
        : [
            {
              id: `${sectionId}-state-item`,
              renderer: 'empty' as const,
              title: getStateTitle(semantic, labels),
              displayHeight: 360,
            },
          ],
    },
  ];
}

function buildPortfolioAssetSections({
  allNetworksBadgeImageUrl,
  expanded,
  isAllNetworks,
  labels,
  locale,
  payload,
}: {
  allNetworksBadgeImageUrl?: string;
  expanded: boolean;
  isAllNetworks: boolean;
  labels: IHomeNativeLabels;
  locale: string;
  payload: IHomeSpotLegacyPayload | undefined;
}): IHomeContainerSection[] {
  const sortedTokens = sortTokensByFiatValue({
    tokens: payload?.tokens ?? [],
    map: payload?.tokenListMap ?? {},
  });
  const visibleTokens = expanded
    ? sortedTokens
    : sortedTokens.slice(0, VISIBLE_ROW_LIMIT);
  const currency = payload?.accountTokensWorthCurrency ?? 'USD';
  const sections: IHomeContainerSection[] = [
    {
      id: 'portfolio-assets',
      items: visibleTokens.map((token) => {
        const fiat = payload?.tokenListMap[token.$key];
        const priceChange = Number(fiat?.price24h);
        let badgeImageUrl: string | undefined;
        if (token.networkId) {
          badgeImageUrl = payload?.networksMap[token.networkId]?.logoURI;
        } else if (isAllNetworks) {
          badgeImageUrl = allNetworksBadgeImageUrl;
        }
        return {
          id: token.$key,
          renderer: 'asset' as const,
          title: token.symbol || token.name,
          subtitle: formatCurrency(fiat?.price, currency, locale),
          subtitleDetail: Number.isFinite(priceChange)
            ? `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%`
            : undefined,
          subtitleDetailColor: getPriceChangeColor(priceChange),
          value: formatAmount(fiat?.balanceParsed ?? fiat?.balance),
          detail: formatCurrency(fiat?.fiatValue, currency, locale),
          imageUrl: token.logoURI,
          titleAccessoryIcon:
            token.isNative &&
            !isAllNetworks &&
            !payload?.networksMap[token.networkId ?? '']
              ? ('gas' as const)
              : undefined,
          badgeImageUrl,
          actionId: HOME_SECTION_ACTION_IDS.openAsset,
        };
      }),
    },
  ];
  if (sortedTokens.length > VISIBLE_ROW_LIMIT) {
    if (expanded) {
      sections.push({
        id: 'portfolio-assets-add-token',
        items: [
          {
            id: 'portfolio-assets-add-token',
            renderer: 'addToken',
            title: labels.addTokenInstruction,
            buttonTitle: labels.addTokenLabel,
            showChevron: true,
            actionId:
              MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.openManageToken,
          },
        ],
      });
    }
    sections.push({
      id: 'portfolio-assets-toggle',
      items: [
        {
          id: 'portfolio-assets-toggle',
          renderer: 'showMore',
          title: expanded ? labels.showLess : labels.showMore,
          actionId:
            MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.togglePortfolioAssetsExpanded,
        },
      ],
    });
  }
  return sections;
}

function buildDeFiSections({
  expanded,
  formatActionLabel,
  labels,
  locale,
  payload,
  sectionTitle,
  toggleActionId,
}: {
  expanded: boolean;
  formatActionLabel?: (id: ETranslations) => string;
  labels: IHomeNativeLabels;
  locale: string;
  payload: IHomeDeFiLegacyPayload | undefined;
  sectionTitle?: string;
  toggleActionId: string;
}): IHomeContainerSection[] {
  const protocols = payload?.protocols ?? [];
  const visibleProtocols = expanded
    ? protocols
    : protocols.slice(0, VISIBLE_ROW_LIMIT);
  const sections: IHomeContainerSection[] = [
    {
      id: sectionTitle ? 'portfolio-defi-protocols' : 'defi-protocols',
      title: sectionTitle,
      items: visibleProtocols.map((protocol, index) => {
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
          badges: formatActionLabel
            ? getProtocolActionBadgeLabelIds({
                protocol,
                supportedActions: payload?.supportedActions ?? [],
              }).map(formatActionLabel)
            : [],
          imageUrl: summary?.protocolLogo,
          showChevron: true,
          showDivider: index < visibleProtocols.length - 1,
          actionId: HOME_SECTION_ACTION_IDS.openDeFiProtocol,
        };
      }),
    },
  ];
  if (protocols.length > VISIBLE_ROW_LIMIT) {
    sections.push({
      id: sectionTitle ? 'portfolio-defi-toggle' : 'defi-toggle',
      items: [
        {
          id: sectionTitle ? 'portfolio-defi-toggle' : 'defi-toggle',
          renderer: 'showMore',
          title: expanded ? labels.showLess : labels.showMore,
          actionId: toggleActionId,
        },
      ],
    });
  }
  return sections;
}

function buildMarketSections(
  payload: IHomePopularTradingPayload | undefined,
  labels: IHomeNativeLabels,
  locale: string,
  networkImageById: Record<string, string>,
  recommendationState?: IHomeNativeMarketRecommendationState,
): IHomeContainerSection[] {
  if (!payload?.rows.length) {
    return [];
  }
  const selectedCategoryId = payload.resolvedCategoryId;
  const isRecommendation = payload.favoriteMode === 'recommendation';
  const selectedRecommendationIds = new Set(
    recommendationState?.selectedRowIds ?? [],
  );
  const visibleRows = payload.rows.slice(0, isRecommendation ? 4 : 3);
  const shouldShowMore =
    !isRecommendation &&
    (payload.favoriteMode !== 'favorites' || payload.totalFavorites > 3);
  return [
    {
      id: 'portfolio-market',
      title: labels.market,
      layout: isRecommendation ? 'marketRecommendations' : undefined,
      actionTitle: isRecommendation
        ? recommendationState?.actionTitle
        : undefined,
      actionId: isRecommendation
        ? MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.addRecommended
        : undefined,
      actionDisabled: isRecommendation && selectedRecommendationIds.size === 0,
      items: [
        {
          id: 'market-tabs',
          renderer: 'marketTabs',
          title: labels.market,
          segments: payload.categories.map((category) => ({
            id: category.id,
            title: category.name,
            imageUrl: category.icon,
            leadingIcon:
              category.iconName === 'StarOutline'
                ? ('star' as const)
                : undefined,
            iconOnly: category.iconOnly,
            selected: category.id === selectedCategoryId,
            actionId: `${MOBILE_NATIVE_HOME_MARKET_CATEGORY_ACTION_PREFIX}${category.id}`,
          })),
        },
        ...visibleRows.map((token) => {
          const rowId = getHomeMarketTokenRowId(token);
          const favorite =
            (isRecommendation && selectedRecommendationIds.has(rowId)) ||
            payload.watchListItems.some((item) =>
              token.perpsCoin
                ? item.perpsCoin === token.perpsCoin
                : item.chainId === token.chainId &&
                  item.contractAddress.toLowerCase() ===
                    token.contractAddress.toLowerCase(),
            );
          return {
            id: rowId,
            renderer: 'market' as const,
            title: token.symbol,
            subtitle: isRecommendation
              ? token.name
              : (token.stock?.subtitle ?? token.perpsSubtitle),
            subtitleDetail: isRecommendation
              ? undefined
              : formatCompactCurrency(token.volume24h, locale),
            value: isRecommendation
              ? undefined
              : formatCurrency(token.price, 'USD', locale),
            detail: isRecommendation
              ? undefined
              : `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%`,
            imageUrl: token.logoUrl,
            imageUrls: token.logoUrls,
            titleAccessoryImageUrl: token.stock?.sourceLogoUri,
            badgeImageUrl: token.perpsCoin
              ? undefined
              : networkImageById[token.chainId],
            badge: token.maxLeverage ? `${token.maxLeverage}x` : undefined,
            communityRecognized: token.communityRecognized,
            favorite,
            favoriteActionId: isRecommendation
              ? undefined
              : MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.toggleFavorite,
            favoriteLabel: favorite
              ? labels.favoriteRemove
              : labels.favoriteAdd,
            accentColor: getPriceChangeColor(token.priceChange24h),
            actionId: isRecommendation
              ? MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.toggleRecommended
              : HOME_SECTION_ACTION_IDS.openMarket,
          };
        }),
        ...(shouldShowMore
          ? [
              {
                id: 'market-show-more',
                renderer: 'showMore' as const,
                title: labels.viewMore,
                showChevron: true,
                actionId: MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.viewMore,
              },
            ]
          : []),
      ],
    },
  ];
}

function buildPerpsSections({
  labels,
  locale,
  market,
  payload,
}: {
  labels: IHomeNativeLabels;
  locale: string;
  market: IHomePopularTradingPayload | undefined;
  payload: IHomePerpsLegacyPayload | undefined;
}): IHomeContainerSection[] {
  const holdings = payload?.view.holdings ?? [];
  const positions = payload?.view.positions ?? [];
  const sections: IHomeContainerSection[] = [];
  if (holdings.length > 0) {
    sections.push({
      id: 'perps-holdings',
      items: holdings.map((holding, index) => ({
        id: `holding:${holding.symbol}:${index}`,
        renderer: 'perps',
        title: holding.displaySymbol,
        subtitle: formatAmount(holding.balance),
        value: formatCurrency(holding.valueUsd, 'USD', locale),
        detail:
          holding.pnlUsd === undefined
            ? '--'
            : `${holding.pnlUsd < 0 ? '-' : '+'}${formatCurrency(
                Math.abs(holding.pnlUsd),
                'USD',
                locale,
              )}`,
        imageUrl: getHyperliquidTokenImageUrl(holding.symbol),
        badgeImageUrl: HYPER_EVM_LOGO_URI,
        accentColor: getPriceChangeColor(holding.pnlUsd ?? 0),
        actionId: HOME_SECTION_ACTION_IDS.openPerps,
      })),
    });
  }
  if (positions.length > 0) {
    sections.push({
      id: 'perps-positions',
      title: labels.positions,
      items: positions.map((position, index) => ({
        id: `position:${position.coin}:${index}`,
        renderer: 'perps',
        title: position.coin,
        subtitle: `${labels.margin}: ${formatCurrency(
          position.marginUsd,
          'USD',
          locale,
        )}`,
        value: `${formatAmount(position.sizeCoin)} ${position.coin}`,
        detail: formatCurrency(position.pnlUsd, 'USD', locale),
        badge: `${position.side === 'long' ? labels.long : labels.short} ${
          position.leverageValue
        }x`,
        imageUrl: getHyperliquidTokenImageUrl(position.coin),
        actionId: HOME_SECTION_ACTION_IDS.openPerps,
      })),
    });
  }
  if (market?.perpsHotRows.length) {
    sections.push({
      id: 'perps-hot-markets',
      title: labels.hotMarkets,
      items: market.perpsHotRows.slice(0, 5).map((token) => ({
        id: getHomeMarketTokenRowId(token),
        renderer: 'perps',
        title: token.symbol,
        subtitle: formatCompactCurrency(token.volume24h, locale),
        value: formatCurrency(token.price, 'USD', locale),
        detail: `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%`,
        badge: token.maxLeverage ? `${token.maxLeverage}x` : undefined,
        imageUrl: token.logoUrl,
        accentColor: getPriceChangeColor(token.priceChange24h),
        actionId: HOME_SECTION_ACTION_IDS.openMarket,
      })),
    });
    sections.push({
      id: 'perps-hot-markets-more',
      items: [
        {
          id: 'perps-hot-markets-more',
          renderer: 'showMore',
          title: labels.viewMore,
          showChevron: true,
          actionId: MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.viewMorePerps,
        },
      ],
    });
  }
  return sections;
}

function buildEarnSections(
  payload: IHomePopularTradingPayload | undefined,
  labels: IHomeNativeLabels,
): IHomeContainerSection[] {
  if (!payload?.earnRows.length) {
    return [];
  }
  return [
    {
      id: 'portfolio-earn',
      title: labels.earn,
      actionTitle: labels.viewMore,
      actionId: HOME_SECTION_ACTION_IDS.openEarn,
      items: payload.earnRows.map((item) => ({
        id: `earn:${item.symbol}:${item.protocols[0]?.provider ?? ''}`,
        renderer: 'earn',
        title: item.symbol,
        subtitle: item.name,
        value: formatEarnApr(item),
        imageUrl: item.logoURI,
        actionId: HOME_SECTION_ACTION_IDS.openEarn,
      })),
    },
  ];
}

function getHistoryStatusLabel(
  status: EDecodedTxStatus,
  labels: IHomeNativeLabels,
): string | undefined {
  if (status === EDecodedTxStatus.Confirmed) {
    return undefined;
  }
  if (status === EDecodedTxStatus.Failed) {
    return labels.statusFailed;
  }
  if (status === EDecodedTxStatus.Pending) {
    return labels.statusPending;
  }
  return undefined;
}

function getHistoryAddressLabel({
  address,
  addressMap,
  networkId,
}: {
  address?: string;
  addressMap: Record<string, IAddressBadge>;
  networkId: string;
}): string | undefined {
  if (!address) {
    return undefined;
  }
  return addressMap[buildAddressMapInfoKey({ networkId, address })]?.label;
}

function getHistoryTransferTarget(
  transfer: IDecodedTxActionAssetTransfer,
): string | undefined {
  const isZeroAddress = (address?: string) =>
    address?.toLowerCase() === '0x0000000000000000000000000000000000000000';
  if (transfer.sends.length > 0 && transfer.receives.length === 0) {
    const targets = Array.from(
      new Set(
        transfer.sends
          .map((item) => item.to)
          .filter((address) => address && !isZeroAddress(address)),
      ),
    );
    return targets.length === 1 ? targets[0] : transfer.to;
  }
  if (transfer.sends.length === 0 && transfer.receives.length > 0) {
    const targets = Array.from(
      new Set(
        transfer.receives
          .map((item) => item.from)
          .filter((address) => address && !isZeroAddress(address)),
      ),
    );
    return targets.length === 1 ? targets[0] : transfer.to || transfer.from;
  }
  return transfer.to;
}

function getHistoryDisplay({
  addressMap,
  history,
  labels,
  locale,
}: {
  addressMap: Record<string, IAddressBadge>;
  history: IAccountHistoryTx;
  labels: IHomeNativeLabels;
  locale: string;
}) {
  const action = getDisplayedActions({ decodedTx: history.decodedTx })[0];
  const timestamp =
    history.decodedTx.updatedAt ?? history.decodedTx.createdAt ?? 0;
  const networkLogoURI = history.decodedTx.networkLogoURI;
  const networkId = history.decodedTx.networkId;

  if (action?.type === EDecodedTxActionType.TOKEN_APPROVE) {
    const approve = action.tokenApprove;
    const amount = new BigNumber(approve?.amount ?? '');
    const isIncrease =
      approve?.approveType === EApproveType.IncreaseAllowance ||
      approve?.approveType === EApproveType.IncreaseApproval;
    const isRevoke = !isIncrease && amount.isFinite() && amount.eq(0);
    let detail: string | undefined;
    if (approve?.isInfiniteAmount) {
      detail = labels.unlimited;
    } else if (approve?.amount && approve.symbol) {
      detail = `${formatAmount(approve.amount)} ${approve.symbol}`;
    }
    return {
      title:
        approve?.label ||
        (isRevoke
          ? labels.revokeApprove(approve?.symbol ?? '')
          : labels.approve),
      subtitle:
        getHistoryAddressLabel({
          address: approve?.spender,
          addressMap,
          networkId,
        }) ||
        history.decodedTx.interactInfo?.name ||
        accountUtils.shortenAddress({ address: approve?.spender ?? '' }) ||
        formatTimestamp(timestamp, locale),
      value: approve?.name || approve?.symbol,
      detail,
      imageUrl: approve?.icon || networkLogoURI,
    };
  }

  if (action?.type === EDecodedTxActionType.FUNCTION_CALL) {
    const call = action.functionCall;
    return {
      title: call?.functionName || labels.contract,
      subtitle:
        getHistoryAddressLabel({
          address: call?.to,
          addressMap,
          networkId,
        }) ||
        history.decodedTx.interactInfo?.name ||
        accountUtils.shortenAddress({ address: call?.to ?? '' }) ||
        formatTimestamp(timestamp, locale),
      imageUrl: call?.icon || networkLogoURI,
    };
  }

  const transfer = action?.assetTransfer;
  if (!transfer) {
    const unknown = action?.unknownAction;
    return {
      title: unknown?.label || labels.contract,
      subtitle:
        getHistoryAddressLabel({
          address: unknown?.to,
          addressMap,
          networkId,
        }) ||
        history.decodedTx.interactInfo?.name ||
        accountUtils.shortenAddress({ address: unknown?.to ?? '' }) ||
        formatTimestamp(timestamp, locale),
      imageUrl: unknown?.icon || networkLogoURI,
    };
  }

  const send = transfer.sends[0];
  const receive = transfer.receives[0];
  const hasSend = Boolean(send);
  const hasReceive = Boolean(receive);
  const isOutgoing =
    history.decodedTx.payload?.type === EOnChainHistoryTxType.Send ||
    action.direction === EDecodedTxDirection.OUT;
  const item = hasSend && !hasReceive ? send : (receive ?? send);
  const secondaryItem = hasSend && hasReceive ? send : undefined;
  const target = getHistoryTransferTarget(transfer);
  let defaultTitle = isOutgoing ? labels.send : labels.receive;
  if (transfer.isInternalSwap) {
    defaultTitle = labels.swap;
  } else if (hasSend && !hasReceive) {
    defaultTitle = labels.send;
  } else if (!hasSend && hasReceive) {
    defaultTitle = labels.receive;
  }
  const subtitle =
    getHistoryAddressLabel({ address: target, addressMap, networkId }) ||
    transfer.application?.name ||
    history.decodedTx.interactInfo?.name ||
    accountUtils.shortenAddress({ address: target ?? '' }) ||
    formatTimestamp(timestamp, locale);
  if (!item) {
    return {
      title: transfer.label || defaultTitle,
      subtitle,
      imageUrl: networkLogoURI,
    };
  }
  const sign = item === send ? '-' : '+';
  const fiatValue = item.price
    ? new BigNumber(item.amount).times(item.price).toFixed()
    : undefined;
  let detail: string | undefined;
  if (secondaryItem) {
    detail = `-${formatAmount(secondaryItem.amount)} ${secondaryItem.symbol}`;
  } else if (fiatValue) {
    detail = formatCurrency(fiatValue, 'USD', locale);
  }
  return {
    title: transfer.label || defaultTitle,
    subtitle,
    value: `${sign}${formatAmount(item.amount)} ${item.symbol}`,
    detail,
    imageUrl: secondaryItem?.icon || item.icon || networkLogoURI,
    secondaryImageUrl: secondaryItem ? item.icon : undefined,
    accentColor: item === send ? undefined : '#1F9D67',
  };
}

function buildHistorySections(
  payload: IHomeHistoryStorePayload | undefined,
  labels: IHomeNativeLabels,
  locale: string,
  isAllNetworks: boolean,
): IHomeContainerSection[] {
  const groups = new Map<string, IAccountHistoryTx[]>();
  (payload?.data ?? []).forEach((history) => {
    const timestamp =
      history.decodedTx.updatedAt ?? history.decodedTx.createdAt ?? 0;
    const title = formatSectionDate(timestamp, locale);
    groups.set(title, [...(groups.get(title) ?? []), history]);
  });
  return Array.from(groups.entries()).map(([title, histories], index) => ({
    id: `history:${index}:${title}`,
    title,
    items: histories.map((history) => {
      const display = getHistoryDisplay({
        addressMap: payload?.addressMap ?? {},
        history,
        labels,
        locale,
      });
      return {
        id: history.id,
        renderer: 'history',
        ...display,
        badgeImageUrl: isAllNetworks
          ? history.decodedTx.networkLogoURI
          : undefined,
        badge: getHistoryStatusLabel(
          history.displayStatus ?? history.decodedTx.status,
          labels,
        ),
        actionId: HOME_SECTION_ACTION_IDS.openHistory,
      };
    }),
  }));
}

function buildNFTSections(
  payload: IHomeNFTLegacyPayload | undefined,
  networkImageById: Record<string, string>,
): IHomeContainerSection[] {
  return [
    {
      id: 'nft-collectibles',
      layout: 'grid',
      items: (payload?.data ?? []).map((nft) => {
        const amount = new BigNumber(nft.amount ?? 1);
        const showAmount =
          nft.collectionType === ENFTType.ERC1155 && amount.gt(1);
        return {
          id: getHomeNFTItemRowId(nft),
          renderer: 'nft',
          title: nft.metadata?.name ?? '-',
          subtitle: nft.collectionName,
          value: showAmount
            ? `x${
                amount.gt(SHOW_NFT_AMOUNT_MAX)
                  ? `${SHOW_NFT_AMOUNT_MAX}+`
                  : nft.amount
              }`
            : undefined,
          imageUrl: nft.metadata?.image,
          badgeImageUrl: nft.networkId
            ? networkImageById[nft.networkId]
            : undefined,
          actionId: HOME_SECTION_ACTION_IDS.openNFT,
        };
      }),
    },
  ];
}

function getDeFiTotal(payload: IHomeDeFiLegacyPayload | undefined): number {
  return Object.values(payload?.protocolMap ?? {}).reduce(
    (total, protocol) => total + Number(protocol.netWorth || 0),
    0,
  );
}

export function buildMobileNativeHomeViewModelSections({
  allNetworksBadgeImageUrl,
  expanded,
  formatActionLabel,
  labels,
  locale,
  marketRecommendationState,
  payloads,
  sectionTitle,
  sectionId,
  semantic,
  isAllNetworks = false,
}: {
  allNetworksBadgeImageUrl?: string;
  expanded?: IHomeNativeExpandedState;
  formatActionLabel?: (id: ETranslations) => string;
  labels: IHomeNativeLabels;
  locale: string;
  marketRecommendationState?: IHomeNativeMarketRecommendationState;
  payloads: IHomeNativePayloads;
  sectionTitle?: string;
  sectionId: IHomeContainerTabId;
  semantic: IHomeSectionSemanticModel;
  isAllNetworks?: boolean;
}): IHomeContainerSection[] {
  const state = buildStateSection({ labels, sectionId, semantic });
  if (state) {
    return state;
  }
  const resolvedExpanded = expanded ?? {
    defi: false,
    portfolioAssets: false,
    portfolioDeFi: false,
  };
  switch (sectionId) {
    case 'portfolio': {
      const deFiTotal = getDeFiTotal(payloads.defi);
      return [
        ...buildPortfolioAssetSections({
          allNetworksBadgeImageUrl,
          expanded: resolvedExpanded.portfolioAssets,
          isAllNetworks,
          labels,
          locale,
          payload: payloads.portfolio,
        }),
        ...(payloads.defi?.protocols.length
          ? buildDeFiSections({
              expanded: resolvedExpanded.portfolioDeFi,
              formatActionLabel,
              labels,
              locale,
              payload: payloads.defi,
              sectionTitle: `DeFi · ${formatCurrency(
                deFiTotal,
                payloads.defi.currency,
                locale,
              )}`,
              toggleActionId:
                MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.togglePortfolioDeFiExpanded,
            })
          : []),
        ...buildMarketSections(
          payloads.market,
          labels,
          locale,
          Object.fromEntries(
            Object.entries(payloads.portfolio?.networksMap ?? {}).flatMap(
              ([networkId, network]) =>
                network.logoURI ? [[networkId, network.logoURI]] : [],
            ),
          ),
          marketRecommendationState,
        ),
        ...buildEarnSections(payloads.market, labels),
      ];
    }
    case 'perps':
      return buildPerpsSections({
        labels,
        locale,
        market: payloads.market,
        payload: payloads.perps,
      });
    case 'defi':
      return buildDeFiSections({
        expanded: resolvedExpanded.defi,
        formatActionLabel,
        labels,
        locale,
        payload: payloads.defi,
        sectionTitle,
        toggleActionId:
          MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.toggleDeFiExpanded,
      });
    case 'nft':
      return buildNFTSections(
        payloads.nft,
        Object.fromEntries(
          Object.entries(payloads.portfolio?.networksMap ?? {}).flatMap(
            ([networkId, network]) =>
              network.logoURI ? [[networkId, network.logoURI]] : [],
          ),
        ),
      );
    case 'history':
      return buildHistorySections(
        payloads.history,
        labels,
        locale,
        isAllNetworks,
      );
    default:
      return [];
  }
}

export {
  MOBILE_NATIVE_HOME_MARKET_CATEGORY_ACTION_PREFIX,
  MOBILE_NATIVE_HOME_MARKET_ACTION_IDS,
  MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS,
  getDeFiTotal,
};
export type {
  IHomeNativeExpandedState,
  IHomeNativeLabels,
  IHomeNativeMarketRecommendationState,
  IHomeNativePayloads,
};
