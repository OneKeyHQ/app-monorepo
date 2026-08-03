import BigNumber from 'bignumber.js';

import { getProtocolActionBadgeLabelIds } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  buildAprRangeText,
  buildAprText,
  formatRewardText,
} from '@onekeyhq/kit/src/views/Earn/components/AprText.utils';
import type { IHomePopularTradingPayload } from '@onekeyhq/kit/src/views/Home/components/PopularTrading/types';
import type {
  IHomeActionsPresentation,
  IHomeBannerPresentation,
  IHomeBodyPresentation,
} from '@onekeyhq/kit/src/views/Home/model/policies/homeDisplayModelPolicy';
import type { IHomeDeFiLegacyPayload } from '@onekeyhq/kit/src/views/Home/model/sections/defi/homeDeFiSourceAdapter';
import type { IHomeHistoryStorePayload } from '@onekeyhq/kit/src/views/Home/model/sections/history/homeHistorySourceAdapter';
import { HOME_HISTORY_ACTION_IDS } from '@onekeyhq/kit/src/views/Home/model/sections/history/homeHistoryStoreModel';
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
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import { buildAddressMapInfoKey } from '@onekeyhq/shared/src/utils/historyUtils';
import {
  type IFormatDisplayNumberPart,
  formatBalance,
  formatDisplayNumber,
  formatMarketCap,
  formatPrice,
  formatPriceChange,
  formatValue,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';
import {
  UNAVAILABLE_DISPLAY,
  displayFiatValueOrUnavailable,
  displayOrUnavailable,
  isValidNumberValue,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';
import { getDisplayedActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
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
const MOBILE_NATIVE_HOME_BANNER_SKELETON_ID = 'home-banner-loading';
const MOBILE_NATIVE_HOME_STANDARD_ACTION_ROW_HEIGHT = 62;
const MOBILE_NATIVE_HOME_ZERO_BALANCE_ACTION_ROW_HEIGHT = 98;

type IMobileNativeHomeBannerPresentation = 'content' | 'hidden' | 'loading';
type IMobileNativeHomeActionLayout = 'loading' | 'standard' | 'zeroBalance';
type IMobileNativeHomeTabTopology = {
  destinations?: Readonly<
    Partial<Record<IHomeContainerTabId, 'inline' | 'web'>>
  >;
  tabIds: readonly IHomeContainerTabId[];
};
type IMobileNativeHomePortfolioFilterPresentation = {
  show: boolean;
  value: boolean;
};
type IMobileNativeHomePortfolioPresentation = {
  assetItemIdByPresentationId: Readonly<Record<string, string>>;
  sections: IHomeContainerSection[];
};

const DEFAULT_MOBILE_NATIVE_HOME_TAB_TOPOLOGY: IMobileNativeHomeTabTopology = {
  destinations: { portfolio: 'inline' },
  tabIds: ['portfolio'],
};

function resolveMobileNativeHomeTabTopology({
  current,
  lastCommitted,
}: {
  current?: IMobileNativeHomeTabTopology;
  lastCommitted?: IMobileNativeHomeTabTopology;
}): IMobileNativeHomeTabTopology {
  return current ?? lastCommitted ?? DEFAULT_MOBILE_NATIVE_HOME_TAB_TOPOLOGY;
}

function resolveMobileNativeHomeActionLayout({
  actionPresentationKind,
}: {
  actionPresentationKind: IHomeActionsPresentation['kind'];
}): IMobileNativeHomeActionLayout {
  if (
    actionPresentationKind === 'funded' ||
    actionPresentationKind === 'hidden'
  ) {
    return 'standard';
  }
  if (actionPresentationKind === 'zero') {
    return 'zeroBalance';
  }
  return 'loading';
}

function resolveMobileNativeHomeActionRowHeight({
  actionLayout,
}: {
  actionLayout: IMobileNativeHomeActionLayout;
}): number {
  return actionLayout === 'zeroBalance'
    ? MOBILE_NATIVE_HOME_ZERO_BALANCE_ACTION_ROW_HEIGHT
    : MOBILE_NATIVE_HOME_STANDARD_ACTION_ROW_HEIGHT;
}

function resolveMobileNativeHomeBannerPresentation({
  bannerPolicyKind,
  bannerResourceKind,
  hasBannerContent,
}: {
  bannerPolicyKind: IHomeBannerPresentation['kind'];
  bannerResourceKind:
    | 'empty'
    | 'error'
    | 'idle'
    | 'loading'
    | 'partial'
    | 'ready';
  hasBannerContent: boolean;
}): IMobileNativeHomeBannerPresentation {
  if (bannerPolicyKind === 'hidden') {
    return 'hidden';
  }
  if (bannerPolicyKind === 'pending') {
    return 'loading';
  }
  if (hasBannerContent) {
    return 'content';
  }
  if (
    bannerResourceKind === 'ready' ||
    bannerResourceKind === 'empty' ||
    bannerResourceKind === 'error'
  ) {
    return 'hidden';
  }
  if (
    hasBannerContent ||
    bannerResourceKind === 'idle' ||
    bannerResourceKind === 'loading' ||
    bannerResourceKind === 'partial'
  ) {
    return 'loading';
  }
  return 'hidden';
}

function buildMobileNativeHomePortfolioPresentation(
  sections: IHomeContainerSection[],
): IMobileNativeHomePortfolioPresentation {
  const assetItemIdByPresentationId: Record<string, string> = {};
  // Native row ids are presentation identity, not Store business identity.
  // Position ids let cached owners reconfigure existing cells; the renderer
  // maps them back to the current token keys before dispatching an intent.
  return {
    assetItemIdByPresentationId,
    sections: sections.map((section) => {
      if (section.id !== 'portfolio-assets') {
        return section;
      }
      return {
        ...section,
        items: section.items.map((item, index) => {
          const presentationId = `portfolio-assets-row-${index}`;
          assetItemIdByPresentationId[presentationId] = item.id;
          return { ...item, id: presentationId };
        }),
      };
    }),
  };
}

function resolveMobileNativeHomePortfolioSections({
  current,
  lastCommitted,
  loading,
}: {
  current: IHomeContainerSection[];
  lastCommitted?: IHomeContainerSection[];
  loading: boolean;
}): IHomeContainerSection[] {
  if (!loading) {
    return current;
  }
  if (!lastCommitted?.length) {
    return current;
  }
  return lastCommitted.map((section) => ({
    ...section,
    actionDisabled: true,
    actionId: undefined,
    items: section.items.map((item) => {
      return {
        ...item,
        actionId: undefined,
        favoriteActionId: undefined,
        segments: item.segments?.map((segment) => ({
          ...segment,
          actionId: '',
        })),
      };
    }),
  }));
}

function resolveMobileNativeHomePortfolioFilterPresentation({
  current,
  lastCommitted,
  loading,
}: {
  current: IMobileNativeHomePortfolioFilterPresentation;
  lastCommitted?: IMobileNativeHomePortfolioFilterPresentation;
  loading: boolean;
}): IMobileNativeHomePortfolioFilterPresentation {
  return loading ? (lastCommitted ?? current) : current;
}

function shouldPresentMobileNativeHomePortfolioChrome({
  bodyPresentationKind,
  hasCommittedPresentation,
}: {
  bodyPresentationKind: IHomeBodyPresentation['kind'];
  hasCommittedPresentation: boolean;
}): boolean {
  return (
    bodyPresentationKind === 'portfolio' ||
    (bodyPresentationKind === 'loading' && hasCommittedPresentation)
  );
}

const MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS = {
  openLowValueAssets: 'home.native.portfolio.assets.openLowValueAssets',
  openManageToken: 'home.native.portfolio.assets.manageToken',
  openRiskAssets: 'home.native.portfolio.assets.openRiskAssets',
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
  lowValueAssets: string;
  margin: string;
  market: string;
  noData: string;
  positions: string;
  receive: string;
  revokeApprove: (symbol: string) => string;
  riskAssets: (count: number) => string;
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

type IHomeNativeFiatContext = {
  currencyMap: Record<string, ICurrencyItem>;
  targetCurrencyId: string;
  targetCurrencyUnit: string;
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

function getFallbackCurrencyUnit(currency: string): string {
  return currency.toUpperCase() === 'USD' ? '$' : `${currency.toUpperCase()} `;
}

function formatFiatNumber({
  fiatContext,
  formatter,
  sourceCurrency,
  value,
}: {
  fiatContext?: IHomeNativeFiatContext;
  formatter: typeof formatPrice | typeof formatValue;
  sourceCurrency: string;
  value: string | number;
}): string {
  const targetCurrency = fiatContext?.targetCurrencyId ?? sourceCurrency;
  const convertedValue = fiatContext
    ? convertFiat({
        currencyMap: fiatContext.currencyMap,
        sourceCurrency,
        targetCurrency,
        value,
      })
    : String(value);
  const currencyUnit =
    fiatContext?.currencyMap[targetCurrency]?.unit ??
    fiatContext?.currencyMap[sourceCurrency]?.unit ??
    fiatContext?.targetCurrencyUnit ??
    getFallbackCurrencyUnit(targetCurrency);
  return displayNumberToString(
    formatDisplayNumber(
      formatter(convertedValue, {
        currency: currencyUnit,
      }),
    ),
  );
}

function formatTokenPrice({
  fiatContext,
  sourceCurrency,
  value,
}: {
  fiatContext?: IHomeNativeFiatContext;
  sourceCurrency: string;
  value: string | number | null | undefined;
}): string {
  const displayValue = displayOrUnavailable(value);
  return displayValue === UNAVAILABLE_DISPLAY
    ? UNAVAILABLE_DISPLAY
    : formatFiatNumber({
        fiatContext,
        formatter: formatPrice,
        sourceCurrency,
        value: displayValue,
      });
}

function formatTokenValue({
  balance,
  fiatContext,
  sourceCurrency,
  value,
}: {
  balance: string | number | null | undefined;
  fiatContext?: IHomeNativeFiatContext;
  sourceCurrency: string;
  value: string | number | null | undefined;
}): string {
  const displayValue = displayFiatValueOrUnavailable(value, balance);
  return displayValue === UNAVAILABLE_DISPLAY
    ? UNAVAILABLE_DISPLAY
    : formatFiatNumber({
        fiatContext,
        formatter: formatValue,
        sourceCurrency,
        value: displayValue,
      });
}

function formatTokenPriceChange(
  value: string | number | null | undefined,
): string {
  if (!isValidNumberValue(value)) {
    return UNAVAILABLE_DISPLAY;
  }
  return displayNumberToString(
    formatDisplayNumber(
      formatPriceChange(String(value), {
        showPlusMinusSigns: !new BigNumber(value).isZero(),
      }),
    ),
  );
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

function sumTokenFiatValue({
  map,
  tokens,
}: {
  map: Record<string, { fiatValue?: string }>;
  tokens: { $key: string }[];
}): string {
  return tokens
    .reduce((total, token) => {
      const value = map[token.$key]?.fiatValue;
      return value === undefined || !new BigNumber(value).isFinite()
        ? total
        : total.plus(value);
    }, new BigNumber(0))
    .toFixed();
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

function formatSectionDate(timestamp: number): string {
  const date = new Date(
    timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp,
  );
  return formatDate(date, { hideTimeForever: true });
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
  const emptyDisplayHeight = sectionId === 'perps' ? 600 : 360;
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
              displayHeight: emptyDisplayHeight,
            },
          ],
    },
  ];
}

function buildPortfolioAssetSections({
  actionsEnabled,
  allNetworksBadgeImageUrl,
  expanded,
  fiatContext,
  hideValue,
  isAllNetworks,
  labels,
  loading,
  payload,
}: {
  actionsEnabled: boolean;
  allNetworksBadgeImageUrl?: string;
  expanded: boolean;
  fiatContext?: IHomeNativeFiatContext;
  hideValue: boolean;
  isAllNetworks: boolean;
  labels: IHomeNativeLabels;
  loading: boolean;
  payload: IHomeSpotLegacyPayload | undefined;
}): IHomeContainerSection[] {
  if (loading) {
    return [
      {
        id: 'portfolio-assets',
        items: Array.from({ length: VISIBLE_ROW_LIMIT }, (_, index) => ({
          id: `portfolio-assets-loading-${index}`,
          renderer: 'loading' as const,
          title: labels.loading,
          displayHeight: 68,
        })),
      },
    ];
  }
  const tokenMap = new Map(
    (payload?.tokens ?? []).map((token) => [token.$key, token]),
  );
  const orderedTokens = (payload?.displayIds ?? [])
    .map((id) => tokenMap.get(id))
    .filter((token): token is NonNullable<typeof token> => Boolean(token));
  const orderedTokenIds = new Set(orderedTokens.map((token) => token.$key));
  const displayTokens = [
    ...orderedTokens,
    ...(payload?.tokens ?? []).filter(
      (token) => !orderedTokenIds.has(token.$key),
    ),
  ];
  const smallBalanceTokens = payload?.smallBalanceTokens ?? [];
  const riskTokens = payload?.riskTokens ?? [];
  const smallBalanceTokenCount =
    payload?.smallBalanceTokenCount ?? smallBalanceTokens.length;
  const riskTokenCount = payload?.riskTokenCount ?? riskTokens.length;
  const visibleTokens = expanded
    ? displayTokens
    : displayTokens.slice(0, VISIBLE_ROW_LIMIT);
  const accountCurrency = payload?.accountTokensWorthCurrency ?? 'USD';
  const sections: IHomeContainerSection[] = [
    {
      id: 'portfolio-assets',
      items: visibleTokens.map((token) => {
        const fiat = payload?.tokenListMap[token.$key];
        const priceChange = Number(fiat?.price24h);
        const sourceCurrency = fiat?.currency ?? accountCurrency;
        let badgeImageUrl: string | undefined;
        if (isAllNetworks && token.networkId) {
          badgeImageUrl = payload?.networksMap[token.networkId]?.logoURI;
        } else if (isAllNetworks) {
          badgeImageUrl = allNetworksBadgeImageUrl;
        }
        return {
          id: token.$key,
          renderer: 'asset' as const,
          title: token.symbol || token.name,
          subtitle: formatTokenPrice({
            fiatContext,
            sourceCurrency,
            value: fiat?.price,
          }),
          subtitleDetail: formatTokenPriceChange(fiat?.price24h),
          subtitleDetailColor: getPriceChangeColor(priceChange),
          value: hideValue
            ? '****'
            : formatAmount(fiat?.balanceParsed ?? fiat?.balance),
          detail: hideValue
            ? '****'
            : formatTokenValue({
                balance: fiat?.balanceParsed ?? fiat?.balance,
                fiatContext,
                sourceCurrency,
                value: fiat?.fiatValue,
              }),
          imageUrl: token.logoURI,
          displayHeight: 60,
          titleAccessoryIcon:
            token.isNative && !isAllNetworks ? ('gas' as const) : undefined,
          badgeImageUrl,
          actionId: actionsEnabled
            ? HOME_SECTION_ACTION_IDS.openAsset
            : undefined,
        };
      }),
    },
  ];
  const hasHiddenAssetRows = smallBalanceTokenCount > 0 || riskTokenCount > 0;
  if (expanded && hasHiddenAssetRows) {
    sections.push({
      id: 'portfolio-assets-hidden-groups',
      items: [
        ...(smallBalanceTokenCount > 0
          ? [
              {
                id: 'portfolio-assets-low-value',
                renderer: 'asset' as const,
                title: `${smallBalanceTokenCount} ${labels.lowValueAssets}`,
                displayHeight: 56,
                value: hideValue
                  ? '****'
                  : formatTokenValue({
                      balance: smallBalanceTokenCount,
                      fiatContext,
                      sourceCurrency: accountCurrency,
                      value:
                        payload?.smallBalanceFiatValue ??
                        sumTokenFiatValue({
                          tokens: smallBalanceTokens,
                          map: payload?.smallBalanceMap ?? {},
                        }),
                    }),
                leadingIcon: 'lowValue' as const,
                titleAccessoryIcon: 'question' as const,
                actionId: actionsEnabled
                  ? MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.openLowValueAssets
                  : undefined,
              },
            ]
          : []),
        ...(riskTokenCount > 0
          ? [
              {
                id: 'portfolio-assets-risk',
                renderer: 'asset' as const,
                title: labels.riskAssets(
                  payload?.blockedRiskTokenCount ?? riskTokenCount,
                ),
                displayHeight: 56,
                leadingIcon: 'risk' as const,
                actionId: actionsEnabled
                  ? MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.openRiskAssets
                  : undefined,
              },
            ]
          : []),
      ],
    });
  }
  if (displayTokens.length > VISIBLE_ROW_LIMIT || hasHiddenAssetRows) {
    if (expanded && !payload?.showLpTokensOnly && actionsEnabled) {
      sections.push({
        id: 'portfolio-assets-add-token',
        items: [
          {
            id: 'portfolio-assets-add-token',
            renderer: 'addToken',
            title: labels.addTokenInstruction,
            buttonTitle: labels.addTokenLabel,
            displayHeight: 52,
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
  semantic: IHomeSectionSemanticModel | undefined,
  labels: IHomeNativeLabels,
  locale: string,
  networkImageById: Record<string, string>,
  recommendationState?: IHomeNativeMarketRecommendationState,
): IHomeContainerSection[] {
  if (!payload?.rows.length) {
    if (semantic?.kind === 'loading') {
      return [
        {
          id: 'portfolio-market',
          title: labels.market,
          items: Array.from({ length: 3 }, (_, index) => ({
            id: `portfolio-market-loading-${index}`,
            renderer: 'loading',
            title: labels.loading,
            displayHeight: 68,
          })),
        },
      ];
    }
    return [];
  }
  const actionsEnabled = semantic?.kind === 'ready' && semantic.priority === 1;
  const selectedCategoryId = payload.resolvedCategoryId;
  const isRecommendation = payload.favoriteMode === 'recommendation';
  const selectedRecommendationIds = new Set(
    recommendationState?.selectedRowIds ?? [],
  );
  const visibleRows = payload.rows.slice(0, isRecommendation ? 4 : 3);
  const shouldShowMore =
    !isRecommendation &&
    (payload.favoriteMode !== 'favorites' || payload.totalFavorites > 3);
  const recommendationActionId =
    isRecommendation && actionsEnabled
      ? MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.addRecommended
      : undefined;
  return [
    {
      id: 'portfolio-market',
      title: labels.market,
      layout: isRecommendation ? 'marketRecommendations' : undefined,
      actionTitle: isRecommendation
        ? recommendationState?.actionTitle
        : undefined,
      actionId: recommendationActionId,
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
          const favoriteActionId =
            !isRecommendation && actionsEnabled
              ? MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.toggleFavorite
              : undefined;
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
            favoriteActionId,
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
  historyType?: EOnChainHistoryTxType,
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
  const isUtxoTransfer = [...transfer.sends, ...transfer.receives].some(
    (item) => item.isOwn !== undefined,
  );
  if (isUtxoTransfer) {
    const counterparties =
      historyType === EOnChainHistoryTxType.Receive
        ? transfer.sends.filter((item) => !item.isOwn).map((item) => item.from)
        : transfer.receives
            .filter((item) => !item.isOwn)
            .map((item) => item.to);
    const targets = Array.from(
      new Set(counterparties.filter((address) => Boolean(address))),
    );
    if (targets.length === 1) {
      return targets[0];
    }
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
  const historyType = history.decodedTx.payload?.type;
  const isOutgoing =
    historyType === EOnChainHistoryTxType.Send ||
    action.direction === EDecodedTxDirection.OUT;
  const isUtxoTransfer = [...transfer.sends, ...transfer.receives].some(
    (transferItem) => transferItem.isOwn !== undefined,
  );
  const isUtxoReceive =
    isUtxoTransfer && historyType === EOnChainHistoryTxType.Receive;
  const isUtxoSend =
    isUtxoTransfer &&
    (historyType === EOnChainHistoryTxType.Send ||
      historyType === EOnChainHistoryTxType.PrivateSend);
  const item = hasSend && !hasReceive ? send : (receive ?? send);
  const secondaryItem = hasSend && hasReceive ? send : undefined;
  const target = getHistoryTransferTarget(transfer, historyType);
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
  if (isUtxoSend || isUtxoReceive) {
    const utxoItem = isUtxoReceive ? receive : send;
    if (utxoItem) {
      const amount = new BigNumber(
        history.decodedTx.nativeAmount ?? utxoItem.amount,
      )
        .abs()
        .toFixed();
      const fiatValue = utxoItem.price
        ? new BigNumber(amount).times(utxoItem.price).toFixed()
        : undefined;
      return {
        title: transfer.label || (isUtxoReceive ? labels.receive : labels.send),
        subtitle,
        value: `${isUtxoReceive ? '+' : '-'}${formatAmount(amount)} ${
          utxoItem.symbol
        }`,
        detail: fiatValue
          ? formatCurrency(fiatValue, 'USD', locale)
          : undefined,
        imageUrl: utxoItem.icon || networkLogoURI,
        accentColor: isUtxoReceive ? '#1F9D67' : undefined,
      };
    }
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
  isLoadingMore: boolean,
): IHomeContainerSection[] {
  const groups = new Map<string, IAccountHistoryTx[]>();
  (payload?.data ?? []).forEach((history) => {
    const timestamp =
      history.decodedTx.updatedAt ?? history.decodedTx.createdAt ?? 0;
    const title = formatSectionDate(timestamp);
    groups.set(title, [...(groups.get(title) ?? []), history]);
  });
  const sections = Array.from(groups.entries()).map(
    ([title, histories], index) => ({
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
          renderer: 'history' as const,
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
    }),
  );
  if (isLoadingMore || !payload?.hasMore || sections.length === 0) {
    return sections;
  }
  const lastSectionIndex = sections.length - 1;
  return sections.map((section, index) =>
    index === lastSectionIndex
      ? { ...section, actionId: HOME_HISTORY_ACTION_IDS.loadMore }
      : section,
  );
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
  fiatContext,
  formatActionLabel,
  hideValue = false,
  labels,
  locale,
  marketRecommendationState,
  marketSemantic,
  payloads,
  portfolioAssetsLoading = false,
  sectionTitle,
  sectionId,
  semantic,
  isAllNetworks = false,
  historyLoadingMore = false,
}: {
  allNetworksBadgeImageUrl?: string;
  expanded?: IHomeNativeExpandedState;
  fiatContext?: IHomeNativeFiatContext;
  formatActionLabel?: (id: ETranslations) => string;
  hideValue?: boolean;
  labels: IHomeNativeLabels;
  locale: string;
  marketRecommendationState?: IHomeNativeMarketRecommendationState;
  marketSemantic?: IHomeSectionSemanticModel;
  payloads: IHomeNativePayloads;
  portfolioAssetsLoading?: boolean;
  sectionTitle?: string;
  sectionId: IHomeContainerTabId;
  semantic: IHomeSectionSemanticModel;
  isAllNetworks?: boolean;
  historyLoadingMore?: boolean;
}): IHomeContainerSection[] {
  const state = buildStateSection({ labels, sectionId, semantic });
  if (state) {
    return state;
  }
  if (
    sectionId === 'history' &&
    semantic.kind === 'ready' &&
    (payloads.history?.data.length ?? 0) === 0
  ) {
    return (
      buildStateSection({
        labels,
        sectionId,
        semantic: { kind: 'empty', emptyState: 'history' },
      }) ?? []
    );
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
          actionsEnabled: semantic.kind === 'ready' && semantic.priority === 1,
          allNetworksBadgeImageUrl,
          expanded: resolvedExpanded.portfolioAssets,
          fiatContext,
          hideValue,
          isAllNetworks,
          labels,
          loading: portfolioAssetsLoading,
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
          marketSemantic,
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
        historyLoadingMore,
      );
    default:
      return [];
  }
}

export {
  MOBILE_NATIVE_HOME_BANNER_SKELETON_ID,
  MOBILE_NATIVE_HOME_MARKET_CATEGORY_ACTION_PREFIX,
  MOBILE_NATIVE_HOME_MARKET_ACTION_IDS,
  MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS,
  MOBILE_NATIVE_HOME_STANDARD_ACTION_ROW_HEIGHT,
  buildMobileNativeHomePortfolioPresentation,
  getDeFiTotal,
  resolveMobileNativeHomeActionLayout,
  resolveMobileNativeHomeActionRowHeight,
  resolveMobileNativeHomeBannerPresentation,
  resolveMobileNativeHomePortfolioFilterPresentation,
  resolveMobileNativeHomePortfolioSections,
  resolveMobileNativeHomeTabTopology,
  shouldPresentMobileNativeHomePortfolioChrome,
};
export type {
  IHomeNativeExpandedState,
  IHomeNativeFiatContext,
  IHomeNativeLabels,
  IHomeNativeMarketRecommendationState,
  IHomeNativePayloads,
  IMobileNativeHomePortfolioFilterPresentation,
  IMobileNativeHomePortfolioPresentation,
  IMobileNativeHomeTabTopology,
};
