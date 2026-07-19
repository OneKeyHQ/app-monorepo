import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { Image } from 'react-native';

import {
  Button,
  Dialog,
  ESwitchSize,
  IconButton,
  SizableText,
  Skeleton,
  Stack,
  Switch,
  Toast,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorActiveAccount';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerHome';
import { AllNetworksManagerTrigger } from '@onekeyhq/kit/src/components/AccountSelector/AllNetworksManagerTrigger';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import {
  EmptyAccount,
  EmptyDeFi,
  EmptyNFT,
  EmptyToken,
  EmptyWallet,
} from '@onekeyhq/kit/src/components/Empty';
import { EmptyHistory } from '@onekeyhq/kit/src/components/Empty/EmptyHistory';
import {
  HistoryLoadingView,
  ListLoading,
  NFTListLoadingView,
} from '@onekeyhq/kit/src/components/Loading';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HOME_CONTAINER_SCHEMA_VERSION,
  HOME_CONTAINER_TAB_IDS,
  HomeContainer,
  HomeContainerController,
  type IHomeContainerAction,
  type IHomeContainerCapabilities,
  type IHomeContainerRef,
  type IHomeContainerSection,
  type IHomeContainerSlots,
  type IHomeContainerTab,
  type IHomeContainerTabId,
  type IHomeContainerTheme,
} from '@onekeyhq/native-components';
import { getNetworksSupportFilterScamHistory } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalAssetDetailRoutes,
  EModalAssetListRoutes,
  EModalFiatCryptoRoutes,
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  ETabEarnRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  AllWalletAvatarImages,
  type IAllWalletAvatarImageNames,
} from '@onekeyhq/shared/src/utils/avatarUtils';
import { formatDate, formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  type IFormatDisplayNumberPart,
  formatBalance,
  formatDisplayNumber,
  formatMarketCap,
  formatPrice,
  formatValue,
} from '@onekeyhq/shared/src/utils/numberUtils';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountSelectorTrigger } from '../../components/AccountSelector/hooks/useAccountSelectorTrigger';
import { useUnifiedNetworkSelectorTrigger } from '../../components/AccountSelector/hooks/useUnifiedNetworkSelectorTrigger';
import { ListItem } from '../../components/ListItem';
import { showResourceDetailsDialog } from '../../components/Resource';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '../../hooks/useAllNetwork';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useBlockExplorerNavigation } from '../../hooks/useBlockExplorerNavigation';
import { useCopyAddressWithDeriveType } from '../../hooks/useCopyAccountAddress';
import { useManageToken } from '../../hooks/useManageToken';
import { useLastConfirmedOverviewBalanceAtom } from '../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { openExplorerAddressUrl } from '../../utils/explorerUtils';
import { convertFiat } from '../../utils/fiatConvert';
import {
  buildAprRangeText,
  buildAprText,
  formatRewardText,
} from '../Earn/components/AprText.utils';
import { safePushToEarnRoute } from '../Earn/earnUtils';
import { useNavigateToMarketTab, usePerpsNavigation } from '../Market/hooks';
import { EMarketHomeTab } from '../Market/MarketHomeV2/types';
import { usePrimeAvailable } from '../Prime/hooks/usePrimeAvailable';
import { maybeOpenPrivateSendHistoryDetail } from '../Swap/utils/privateSendHistory';

import { showBalanceDetailsDialog } from './components/BalanceDetailsDialog';
import { formatPortfolioTotal } from './components/DeFiListBlock/formatPortfolioTotal';
import {
  FAVORITES_CATEGORY_ID,
  HOME_PERPS_GUIDE_URL,
  HOME_PERPS_HOT_CATEGORY_ID,
  HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
} from './components/PopularTrading/constants';
import { onHomePageRefresh } from './components/PullToRefresh';
import { RichBlockHeader } from './components/RichBlock/RichBlockHeader';
import { SupportHub } from './components/SupportHub';
import { Upgrade } from './components/Upgrade';
import { ActionItem } from './components/WalletActions/RawActions';
import { useShowWalletActionMore } from './components/WalletActions/WalletActionMore';
import { NativeHomeZeroBalanceWalletActions } from './components/WalletActions/ZeroBalanceWalletActions';
import {
  buildHomeWalletAtomicTabState,
  buildHomeWalletCapabilityTabModel,
} from './homeWalletCapabilityTabModel';
import { useHomeWalletTabSupport } from './hooks/useHomeWalletTabSupport';
import {
  type INativeHomeBalanceStickyState,
  buildNativeHomeBalanceScopeKey,
  getNativeHomeLastConfirmedBalance,
  hasNativeHomeNonZeroWorth,
  hasNativeHomePortfolioHoldings,
  resolveNativeHomeBalanceState,
  resolveNativeHomeFundedHoldings,
  resolveNativeHomeHeaderActionPresentation,
  resolveNativeHomeWalletScopedBalanceState,
} from './nativeHomeBalanceAuthority';
import {
  NATIVE_HOME_ACTION_IDS,
  buildNativeDeFiSections,
  buildNativeHistorySections,
  buildNativeNFTSections,
  buildNativePerpsSections,
  buildNativePortfolioSections,
  resolveNativeHomeListStateSlot,
} from './nativeHomeDataAdapters';
import {
  PerpsHomeHeaderSlot,
  PerpsHomeStateSlot,
} from './pages/PerpsContainer';
import { usePerpsHomePortfolio } from './pages/usePerpsHomePortfolio';
import { useNativeHomeBannersData } from './useNativeHomeBannersData';
import {
  resolveNativeHomeDefaultTokenProjection,
  useNativeHomeDefaultTokenMap,
} from './useNativeHomeDefaultTokenMap';
import { useNativeHomeDeFiData } from './useNativeHomeDeFiData';
import { useNativeHomeHistoryData } from './useNativeHomeHistoryData';
import { useNativeHomeLpTokenData } from './useNativeHomeLpTokenData';
import { useNativeHomeNFTData } from './useNativeHomeNFTData';
import { useNativeHomePortfolioData } from './useNativeHomePortfolioData';
import { useNativeHomeSupplementalData } from './useNativeHomeSupplementalData';

import type { INativeHomePageProps } from './NativeHomePage.types';

const filterScamHistorySupportedNetworkIds = new Set(
  getNetworksSupportFilterScamHistory().map((item) => item.id),
);

function isHomeTabId(value: string): value is IHomeContainerTabId {
  return HOME_CONTAINER_TAB_IDS.some((tabId) => tabId === value);
}

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
        return '0'.repeat(part.value);
      }
      return part.value;
    })
    .join('');
}

function timestampToDate(timestamp: number): Date {
  return new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);
}

function formatNativePriceChange(value: string | number | undefined): string {
  const parsed = new BigNumber(value ?? Number.NaN);
  if (!parsed.isFinite()) return '--';
  return `${parsed.gt(0) ? '+' : ''}${parsed.toFixed(2)}%`;
}

function formatNativeMarketPrice(value: string | number | undefined): string {
  if (value === undefined) return '--';
  return displayNumberToString(
    formatDisplayNumber(formatPrice(value.toString(), { currency: '$' })),
  );
}

function getNativeMarketItemId(
  token: ReturnType<typeof useNativeHomeSupplementalData>['market'][number],
): string {
  return token.perpsCoin
    ? `market:perps:${token.perpsCoin}`
    : `market:${token.chainId}:${token.contractAddress}`;
}

function formatNativeEarnApr(
  item: ReturnType<typeof useNativeHomeSupplementalData>['earn'][number],
): string {
  const rewardUnit = item.rewardUnit ?? 'APR';
  const range = buildAprRangeText({
    minAprInfo: item.minAprInfo,
    maxAprInfo: item.maxAprInfo,
    rewardUnit,
  });
  if (range) return range;
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

export function NativeHomePage({
  debugOverlayEnabled,
  onAction,
  onRenderError,
}: INativeHomePageProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const navigateToMarketTab = useNavigateToMarketTab();
  const { navigateToPerps } = usePerpsNavigation();
  const theme = useTheme();
  const [settings, setSettings] = useSettingsPersistAtom();
  const [{ hideValue }, setSettingsValue] = useSettingsValuePersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [{ byOwner: lastConfirmedBalanceByOwner }] =
    useLastConfirmedOverviewBalanceAtom();
  const {
    activeAccount: {
      account,
      accountName,
      deriveInfo,
      deriveInfoItems,
      deriveType,
      indexedAccount,
      isOthersWallet,
      network,
      vaultSettings,
      wallet,
    },
  } = useActiveAccount({ num: 0 });
  const { openExplorer, requiresNetworkSelection } = useBlockExplorerNavigation(
    network,
    wallet?.id,
  );
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    editable: true,
    keepAllOtherAccounts: true,
    allowSelectEmptyAccount: true,
  });
  const { showUnifiedNetworkSelector } = useUnifiedNetworkSelectorTrigger({
    num: 0,
  });
  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();
  const { handleOnManageToken, manageTokenEnabled } = useManageToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
  });
  const showWalletActionMore = useShowWalletActionMore();
  const { isPrimeAvailable } = usePrimeAvailable();
  const { user } = useOneKeyAuth();
  const {
    isReady: isHomeWalletTabSupportReady,
    isDeFiSupported,
    isPerpsSupported,
  } = useHomeWalletTabSupport({ network });
  const homeWalletCapabilityTabModel = useMemo(
    () =>
      buildHomeWalletCapabilityTabModel({
        isReady: isHomeWalletTabSupportReady,
        isDeFiSupported,
        isPerpsSupported,
      }),
    [isDeFiSupported, isHomeWalletTabSupportReady, isPerpsSupported],
  );
  const isNFTEnabled = Boolean(
    network?.isAllNetworks ||
    (vaultSettings?.NFTEnabled &&
      networkUtils.getEnabledNFTNetworkIds().includes(network?.id ?? '')),
  );
  const filterScamHistorySupported = Boolean(
    network?.isAllNetworks ||
    filterScamHistorySupportedNetworkIds.has(network?.id ?? ''),
  );
  const hasNoUsableWallet = accountUtils.hasNoUsableWallet({
    wallet,
    account,
  });
  const { enabledNetworksCompatibleWithWalletId } =
    useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
      walletId:
        network?.isAllNetworks && !isOthersWallet ? (wallet?.id ?? '') : '',
      networkId: network?.id,
      indexedAccountId: indexedAccount?.id,
      filterNetworksWithoutAccount: true,
    });
  const headerNetworkImageUrls = useMemo(() => {
    if (network?.isAllNetworks && !isOthersWallet) {
      return enabledNetworksCompatibleWithWalletId
        .slice(0, 2)
        .map((item) => item.logoURI)
        .filter((value): value is string => Boolean(value));
    }
    return network?.logoURI ? [network.logoURI] : [];
  }, [
    enabledNetworksCompatibleWithWalletId,
    isOthersWallet,
    network?.isAllNetworks,
    network?.logoURI,
  ]);
  const headerNetworkCount =
    network?.isAllNetworks && !isOthersWallet
      ? enabledNetworksCompatibleWithWalletId.length
      : undefined;
  const nftNetworkImageById = useMemo(() => {
    const entries = enabledNetworksCompatibleWithWalletId
      .filter((item) => Boolean(item.logoURI))
      .map((item) => [item.id, item.logoURI] as const);
    if (network?.id && network.logoURI) {
      entries.push([network.id, network.logoURI]);
    }
    return Object.fromEntries(entries);
  }, [enabledNetworksCompatibleWithWalletId, network?.id, network?.logoURI]);
  const accountImageUrl = useMemo(() => {
    if (!wallet) return undefined;
    const imageName = wallet.avatarInfo?.img as
      | IAllWalletAvatarImageNames
      | undefined;
    const source = imageName
      ? AllWalletAvatarImages[imageName]
      : AllWalletAvatarImages.bear;
    return Image.resolveAssetSource(source)?.uri;
  }, [wallet]);
  const [activeTabId, setActiveTabId] =
    useState<IHomeContainerTabId>('portfolio');
  const [portfolioAssetsExpanded, setPortfolioAssetsExpanded] = useState(false);
  const [portfolioDeFiExpanded, setPortfolioDeFiExpanded] = useState(false);
  const [deFiExpanded, setDeFiExpanded] = useState(false);
  const [selectedMarketCategoryId, setSelectedMarketCategoryId] = useState(
    FAVORITES_CATEGORY_ID,
  );
  const [prefetchedPerpsScopeKey, setPrefetchedPerpsScopeKey] =
    useState<string>();
  const perpsScopeKey = indexedAccount?.id ?? account?.id ?? '';

  const portfolio = useNativeHomePortfolioData({ enabled: true });
  const { map: homeDefaultTokenMap, status: homeDefaultTokenMapStatus } =
    useNativeHomeDefaultTokenMap();
  const homeDefaultTokenProjection = resolveNativeHomeDefaultTokenProjection(
    homeDefaultTokenMapStatus,
  );
  const lpTokens = useNativeHomeLpTokenData();
  const banners = useNativeHomeBannersData();
  const supplemental = useNativeHomeSupplementalData({
    favoritesLabel: intl.formatMessage({
      id: ETranslations.global_favorites,
    }),
    perpsLabel: intl.formatMessage({ id: ETranslations.global_perp }),
    selectedMarketCategoryId,
  });
  const {
    addRecommendedMarketTokens,
    earn: supplementalEarn,
    favoriteCount,
    isMarketRecommendationSelected,
    isTokenFavorite,
    market: supplementalMarket,
    marketCategories,
    marketIsRecommendation,
    marketLoading,
    marketNetworkImageById,
    marketRecommendationSelectedCount,
    resolvedMarketCategoryId,
    toggleMarketRecommendation,
    toggleMarketFavorite,
  } = supplemental;
  const perps = usePerpsHomePortfolio({
    isTabFocused:
      isPerpsSupported &&
      (activeTabId === 'perps' || prefetchedPerpsScopeKey !== perpsScopeKey),
  });
  const deFi = useNativeHomeDeFiData({
    enabled: isDeFiSupported,
    visible: activeTabId === 'defi' || activeTabId === 'portfolio',
  });
  const nft = useNativeHomeNFTData({
    enabled: isNFTEnabled,
    visible: activeTabId === 'nft',
  });
  const history = useNativeHomeHistoryData({
    enabled: true,
    visible: activeTabId === 'history',
  });
  const loadMoreHistory = history.loadMore;

  useEffect(() => {
    if (
      isPerpsSupported &&
      perpsScopeKey &&
      perps.viewState !== 'loading' &&
      prefetchedPerpsScopeKey !== perpsScopeKey
    ) {
      setPrefetchedPerpsScopeKey(perpsScopeKey);
    }
  }, [
    isPerpsSupported,
    perps.viewState,
    perpsScopeKey,
    prefetchedPerpsScopeKey,
  ]);

  const formatters = useMemo(() => {
    const convertNativeFiat = (
      value: string | number | undefined,
      sourceCurrency = settings.currencyInfo.id,
    ) => {
      if (value === undefined) {
        return undefined;
      }
      return convertFiat({
        value,
        sourceCurrency,
        targetCurrency: settings.currencyInfo.id,
        currencyMap,
      });
    };
    const formatFiat = (
      value: string | number | undefined,
      sourceCurrency = settings.currencyInfo.id,
    ) => {
      const converted = convertNativeFiat(value, sourceCurrency);
      if (converted === undefined) {
        return '--';
      }
      return displayNumberToString(
        formatDisplayNumber(
          formatValue(converted, {
            currency: settings.currencyInfo.symbol,
          }),
        ),
      );
    };
    return {
      formatBalance: (value: string) =>
        displayNumberToString(formatDisplayNumber(formatBalance(value))),
      formatFiat,
      formatPrice: (
        value: string | number | undefined,
        sourceCurrency = settings.currencyInfo.id,
      ) => {
        const converted = convertNativeFiat(value, sourceCurrency);
        if (converted === undefined) {
          return '--';
        }
        return displayNumberToString(
          formatDisplayNumber(
            formatPrice(converted.toString(), {
              currency: settings.currencyInfo.symbol,
            }),
          ),
        );
      },
    };
  }, [currencyMap, settings.currencyInfo.id, settings.currencyInfo.symbol]);

  const stateLabels = useMemo(
    () => ({
      empty: intl.formatMessage({ id: ETranslations.global_no_data }),
      loading: '…',
    }),
    [intl],
  );
  const visiblePortfolioTokens = lpTokens.showLpTokensOnly
    ? lpTokens.tokens
    : portfolio.tokens;
  const visiblePortfolioTokenMap = lpTokens.showLpTokensOnly
    ? lpTokens.map
    : portfolio.map;
  const visiblePortfolioInitialized = lpTokens.showLpTokensOnly
    ? lpTokens.initialized
    : portfolio.initialized &&
      (!network?.isAllNetworks || homeDefaultTokenProjection.initialized);
  const smallBalanceValue = useMemo(() => {
    const total = portfolio.smallBalanceTokens.reduce(
      (value, token) =>
        value.plus(portfolio.smallBalanceMap[token.$key]?.fiatValue ?? 0),
      new BigNumber(0),
    );
    const sourceCurrency = portfolio.smallBalanceTokens
      .map((token) => portfolio.smallBalanceMap[token.$key]?.currency)
      .find((value): value is string => Boolean(value));
    return formatters.formatFiat(total.toFixed(), sourceCurrency);
  }, [formatters, portfolio.smallBalanceMap, portfolio.smallBalanceTokens]);

  useEffect(() => {
    setPortfolioAssetsExpanded(false);
    setPortfolioDeFiExpanded(false);
    setDeFiExpanded(false);
  }, [account?.id, lpTokens.showLpTokensOnly, network?.id]);

  const tabTitles = useMemo(
    () => ({
      portfolio: intl.formatMessage({ id: ETranslations.dexmarket_spot }),
      perps: intl.formatMessage({ id: ETranslations.global_perp }),
      defi: intl.formatMessage({ id: ETranslations.global_earn }),
      nft: intl.formatMessage({ id: ETranslations.global_nft }),
      history: intl.formatMessage({ id: ETranslations.global_history }),
    }),
    [intl],
  );

  const portfolioAssetSections = useMemo(
    () =>
      buildNativePortfolioSections({
        tokens: visiblePortfolioTokens,
        tokenMap: visiblePortfolioTokenMap,
        initialized: visiblePortfolioInitialized,
        hideZeroBalanceTokens:
          !lpTokens.showLpTokensOnly &&
          Boolean(network?.isAllNetworks) &&
          homeDefaultTokenProjection.hideZeroBalanceTokens,
        homeDefaultTokenMap,
        customTokens: portfolio.customTokens,
        stateLabels,
        formatters,
        networkImageById: network?.isAllNetworks
          ? nftNetworkImageById
          : undefined,
        expanded: portfolioAssetsExpanded,
        footer: {
          addTokenEnabled: manageTokenEnabled,
          labels: {
            addToken: intl.formatMessage({
              id: ETranslations.add_token_label,
            }),
            addTokenInstruction: intl.formatMessage({
              id: ETranslations.add_token_instruction,
            }),
            lowValueAssets: intl.formatMessage({
              id: ETranslations.low_value_assets,
            }),
            riskAssets: intl.formatMessage(
              {
                id: ETranslations.wallet_collapsed_risk_assets_number,
              },
              { number: portfolio.riskTokens.length },
            ),
            showLess: intl.formatMessage({
              id: ETranslations.global_show_less,
            }),
            showMore: intl.formatMessage({
              id: ETranslations.global_show_more,
            }),
          },
          lowValueAssetsCount: lpTokens.showLpTokensOnly
            ? 0
            : portfolio.smallBalanceTokens.length,
          lowValueAssetsValue: smallBalanceValue,
          riskAssetsCount: lpTokens.showLpTokensOnly
            ? 0
            : portfolio.riskTokens.length,
        },
      }),
    [
      formatters,
      homeDefaultTokenProjection.hideZeroBalanceTokens,
      intl,
      lpTokens.showLpTokensOnly,
      manageTokenEnabled,
      homeDefaultTokenMap,
      network?.isAllNetworks,
      portfolio.riskTokens.length,
      portfolio.customTokens,
      portfolio.smallBalanceTokens.length,
      portfolioAssetsExpanded,
      smallBalanceValue,
      stateLabels,
      visiblePortfolioInitialized,
      visiblePortfolioTokenMap,
      visiblePortfolioTokens,
      nftNetworkImageById,
    ],
  );
  const perpsSections = useMemo(() => {
    const sections = buildNativePerpsSections({
      view: perps.view,
      initialized: perps.viewState !== 'loading',
      labels: {
        long: intl.formatMessage({ id: ETranslations.perp_long }),
        margin: intl.formatMessage({
          id: ETranslations.perp_position_margin,
        }),
        pnl: intl.formatMessage({ id: ETranslations.perp_position_pnl }),
        positions: intl.formatMessage({
          id: ETranslations.perp_position_title,
        }),
        short: intl.formatMessage({ id: ETranslations.perp_short }),
      },
      stateLabels,
      formatters,
      colors: {
        negative: theme.textCritical.val,
        positive: theme.textSuccess.val,
      },
    });
    if (perps.viewState === 'ready' && supplemental.perpsMarket.length > 0) {
      sections.push({
        id: 'perps-hot-markets',
        title: intl.formatMessage({
          id: ETranslations.perp_home_hot_markets__title,
        }),
        items: supplemental.perpsMarket.map((token) => ({
          id: `perps-market:${token.name}`,
          renderer: 'perps',
          title: token.displayName,
          subtitle: `$${displayNumberToString(
            formatDisplayNumber(formatMarketCap(token.volume24h)),
          )}`,
          value: formatters.formatPrice?.(token.markPrice, 'usd') ?? '--',
          detail: formatNativePriceChange(token.change24hPercent),
          badge: `${token.maxLeverage}x`,
          imageUrl: token.tokenImageUrl,
          accentColor:
            token.change24hPercent >= 0
              ? theme.textSuccess.val
              : theme.textCritical.val,
          actionId: NATIVE_HOME_ACTION_IDS.openPerps,
        })),
      });
      sections.push({
        id: 'perps-hot-markets-more',
        items: [
          {
            id: 'perps-hot-markets-more',
            renderer: 'showMore',
            title: intl.formatMessage({
              id: ETranslations.global_view_more,
            }),
            showChevron: true,
            actionId: NATIVE_HOME_ACTION_IDS.openPerpsMarket,
          },
        ],
      });
    }
    return sections;
  }, [
    formatters,
    intl,
    perps.view,
    perps.viewState,
    stateLabels,
    supplemental.perpsMarket,
    theme.textCritical.val,
    theme.textSuccess.val,
  ]);
  const deFiSections = useMemo(
    () =>
      buildNativeDeFiSections({
        protocols: deFi.protocols,
        protocolMap: deFi.protocolMap,
        supportedActions: deFi.supportedActions,
        initialized: deFi.initialized,
        stateLabels,
        formatters,
        formatActionLabel: (labelId) => intl.formatMessage({ id: labelId }),
        labels: {
          positions: intl.formatMessage({ id: ETranslations.earn_positions }),
          showMore: intl.formatMessage({
            id: ETranslations.global_show_more,
          }),
          showLess: intl.formatMessage({
            id: ETranslations.global_show_less,
          }),
        },
        expanded: deFiExpanded,
        toggleActionId: NATIVE_HOME_ACTION_IDS.toggleDeFiExpanded,
      }),
    [
      deFiExpanded,
      deFi.initialized,
      deFi.protocolMap,
      deFi.protocols,
      deFi.supportedActions,
      formatters,
      intl,
      stateLabels,
    ],
  );
  const nftSections = useMemo(
    () =>
      buildNativeNFTSections({
        nfts: nft.data,
        initialized: nft.initialized,
        stateLabels,
        networkImageById: network?.isAllNetworks
          ? nftNetworkImageById
          : undefined,
      }),
    [
      nft.data,
      nft.initialized,
      nftNetworkImageById,
      network?.isAllNetworks,
      stateLabels,
    ],
  );
  const historySections = useMemo(
    () =>
      buildNativeHistorySections({
        addressMap: history.addressMap,
        history: history.data,
        initialized: history.initialized,
        stateLabels,
        labels: {
          approve: intl.formatMessage({ id: ETranslations.global_approve }),
          contract: intl.formatMessage({ id: ETranslations.global_contract }),
          receive: intl.formatMessage({ id: ETranslations.global_receive }),
          send: intl.formatMessage({ id: ETranslations.global_send }),
          status: {
            [EDecodedTxStatus.Failed]: intl.formatMessage({
              id: ETranslations.global_failed,
            }),
            [EDecodedTxStatus.Pending]: intl.formatMessage({
              id: ETranslations.global_pending,
            }),
          },
          swap: intl.formatMessage({ id: ETranslations.global_swap }),
          unknown: intl.formatMessage({ id: ETranslations.global_unknown }),
          unlimited: intl.formatMessage({
            id: ETranslations.swap_page_provider_approve_amount_un_limit,
          }),
          revokeApprove: (symbol) =>
            intl.formatMessage(
              { id: ETranslations.global_revoke_approve },
              { symbol },
            ),
        },
        formatBalance: formatters.formatBalance,
        formatFiat: formatters.formatFiat,
        formatSectionDate: (timestamp) =>
          formatDate(timestampToDate(timestamp), {
            formatTemplate: 'MM/dd/yyyy',
          }),
        formatTimestamp: (timestamp) =>
          formatTime(timestampToDate(timestamp), { hideSeconds: true }),
        loadMoreActionId: history.hasMore
          ? NATIVE_HOME_ACTION_IDS.loadMoreHistory
          : undefined,
        isAllNetworks: Boolean(network?.isAllNetworks),
        positiveValueColor: theme.textSuccess.val,
      }),
    [
      formatters.formatBalance,
      formatters.formatFiat,
      history.addressMap,
      history.data,
      history.hasMore,
      history.initialized,
      intl,
      network?.isAllNetworks,
      stateLabels,
      theme.textSuccess.val,
    ],
  );

  const portfolioSections = useMemo<IHomeContainerSection[]>(() => {
    const sections: IHomeContainerSection[] = [...portfolioAssetSections];

    if (deFi.protocols.length > 0) {
      const deFiTotal = Object.values(deFi.protocolMap).reduce(
        (total, protocol) => total.plus(protocol.netWorth || 0),
        new BigNumber(0),
      );
      sections.push(
        ...buildNativeDeFiSections({
          protocols: deFi.protocols,
          protocolMap: deFi.protocolMap,
          supportedActions: deFi.supportedActions,
          initialized: deFi.initialized,
          stateLabels,
          formatters,
          formatActionLabel: (labelId) => intl.formatMessage({ id: labelId }),
          labels: {
            positions: intl.formatMessage({
              id: ETranslations.earn_positions,
            }),
            showMore: intl.formatMessage({
              id: ETranslations.global_show_more,
            }),
            showLess: intl.formatMessage({
              id: ETranslations.global_show_less,
            }),
          },
          expanded: portfolioDeFiExpanded,
          toggleActionId: NATIVE_HOME_ACTION_IDS.togglePortfolioDeFiExpanded,
          sectionTitle: `${tabTitles.defi} · ${formatters.formatFiat(
            deFiTotal.toFixed(),
          )}`,
        }).map((section) => ({
          ...section,
          id: `portfolio-${section.id}`,
        })),
      );
    }

    sections.push({
      id: 'portfolio-market',
      title: intl.formatMessage({ id: ETranslations.global_market }),
      actionTitle: marketIsRecommendation
        ? intl.formatMessage(
            { id: ETranslations.market_add_number_tokens },
            { number: marketRecommendationSelectedCount },
          )
        : undefined,
      actionId: marketIsRecommendation
        ? 'home.widget.market.addRecommended'
        : undefined,
      actionDisabled:
        marketIsRecommendation && marketRecommendationSelectedCount === 0,
      layout: marketIsRecommendation ? 'marketRecommendations' : undefined,
      items: [
        {
          id: 'market-tabs',
          renderer: 'marketTabs',
          title: intl.formatMessage({ id: ETranslations.global_market }),
          segments: marketCategories.map((category) => ({
            id: category.id,
            title: category.name,
            imageUrl: category.icon,
            leadingIcon: category.leadingIcon,
            iconOnly: category.iconOnly,
            selected: category.id === resolvedMarketCategoryId,
            actionId: `home.widget.market.category:${category.id}`,
          })),
        },
        ...(marketLoading
          ? [
              {
                id: 'market-loading',
                renderer: 'loading' as const,
                title: '',
                displayHeight: 224,
              },
            ]
          : [
              ...supplementalMarket.map((token) => {
                const volume = token.volume24h
                  ? `$${displayNumberToString(
                      formatDisplayNumber(
                        formatMarketCap(token.volume24h.toString()),
                      ),
                    )}`
                  : undefined;
                const favorite = marketIsRecommendation
                  ? isMarketRecommendationSelected(token)
                  : isTokenFavorite(token);
                return {
                  id: getNativeMarketItemId(token),
                  renderer: 'market' as const,
                  title: token.symbol,
                  subtitle: marketIsRecommendation
                    ? token.name
                    : token.stock?.subtitle || token.perpsSubtitle,
                  subtitleDetail: marketIsRecommendation ? undefined : volume,
                  value: marketIsRecommendation
                    ? undefined
                    : formatNativeMarketPrice(token.price),
                  detail: marketIsRecommendation
                    ? undefined
                    : formatNativePriceChange(token.priceChange24h),
                  imageUrl: token.logoUrl,
                  imageUrls: token.logoUrls,
                  titleAccessoryImageUrl: token.stock?.sourceLogoUri,
                  badgeImageUrl: token.perpsCoin
                    ? undefined
                    : marketNetworkImageById[token.chainId] ||
                      nftNetworkImageById[token.chainId],
                  badge: token.maxLeverage
                    ? `${token.maxLeverage}x`
                    : undefined,
                  communityRecognized: token.communityRecognized,
                  favorite,
                  favoriteActionId: marketIsRecommendation
                    ? 'home.widget.market.toggleRecommendation'
                    : 'home.widget.market.favorite',
                  favoriteLabel: intl.formatMessage({
                    id: favorite
                      ? ETranslations.market_remove_from_favorites
                      : ETranslations.market_add_to_favorites,
                  }),
                  accentColor:
                    token.priceChange24h >= 0
                      ? theme.textSuccess.val
                      : theme.textCritical.val,
                  actionId: marketIsRecommendation
                    ? 'home.widget.market.toggleRecommendation'
                    : 'home.widget.market.token',
                };
              }),
              ...(supplementalMarket.length > 0 &&
              (resolvedMarketCategoryId !== FAVORITES_CATEGORY_ID ||
                favoriteCount > 3)
                ? [
                    {
                      id: 'market-show-more',
                      renderer: 'showMore' as const,
                      title: intl.formatMessage({
                        id: ETranslations.global_view_more,
                      }),
                      showChevron: true,
                      actionId: 'home.widget.market.showMore',
                    },
                  ]
                : []),
            ]),
      ],
    });
    sections.push({
      id: 'portfolio-earn',
      title: intl.formatMessage({ id: ETranslations.earn_title }),
      actionTitle: intl.formatMessage({ id: ETranslations.global_view_more }),
      actionId: 'home.widget.earn',
      items: supplementalEarn.map((item) => ({
        id: `earn:${item.symbol}:${item.protocols[0]?.provider ?? ''}`,
        renderer: 'earn',
        title: item.symbol,
        subtitle: item.name,
        value: formatNativeEarnApr(item),
        imageUrl: item.logoURI,
        actionId: 'home.widget.earn',
      })),
    });

    return sections;
  }, [
    deFi.initialized,
    deFi.protocolMap,
    deFi.protocols,
    deFi.supportedActions,
    formatters,
    intl,
    nftNetworkImageById,
    portfolioAssetSections,
    portfolioDeFiExpanded,
    favoriteCount,
    isTokenFavorite,
    isMarketRecommendationSelected,
    marketCategories,
    marketIsRecommendation,
    marketLoading,
    marketRecommendationSelectedCount,
    marketNetworkImageById,
    resolvedMarketCategoryId,
    supplementalEarn,
    supplementalMarket,
    stateLabels,
    tabTitles.defi,
    theme.textCritical.val,
    theme.textSuccess.val,
  ]);

  const nativeTheme = useMemo<IHomeContainerTheme>(
    () => ({
      backgroundColor: theme.bgApp.val,
      cardColor: theme.bgSubdued.val,
      strongColor: theme.bgStrong.val,
      infoBackgroundColor: theme.bgInfo.val,
      infoTextColor: theme.textInfo.val,
      hoverColor: theme.bgHover.val,
      activeColor: theme.bgActive.val,
      subduedIconColor: theme.iconSubdued.val,
      dividerColor: theme.borderSubdued.val,
      primaryTextColor: theme.text.val,
      secondaryTextColor: theme.textSubdued.val,
      accentColor: theme.brand9.val,
      positiveColor: theme.textSuccess.val,
      negativeColor: theme.textCritical.val,
    }),
    [
      theme.bgApp.val,
      theme.bgActive.val,
      theme.bgHover.val,
      theme.bgSubdued.val,
      theme.bgStrong.val,
      theme.bgInfo.val,
      theme.borderSubdued.val,
      theme.brand9.val,
      theme.iconSubdued.val,
      theme.text.val,
      theme.textCritical.val,
      theme.textInfo.val,
      theme.textSubdued.val,
      theme.textSuccess.val,
    ],
  );

  const headerBalanceValue = useMemo(() => {
    let total = new BigNumber(0);
    Object.values(portfolio.map).forEach((fiat) => {
      total = total.plus(
        convertFiat({
          value: fiat.fiatValue || 0,
          sourceCurrency: fiat.currency ?? settings.currencyInfo.id,
          targetCurrency: settings.currencyInfo.id,
          currencyMap,
        }),
      );
    });
    Object.values(deFi.protocolMap).forEach((protocol) => {
      total = total.plus(protocol.netWorth || 0);
    });
    if (isPerpsSupported && perps.view) {
      total = total.plus(
        convertFiat({
          value: perps.view.accountValueUsd,
          sourceCurrency: 'usd',
          targetCurrency: settings.currencyInfo.id,
          currencyMap,
        }),
      );
    }
    return total;
  }, [
    currencyMap,
    deFi.protocolMap,
    isPerpsSupported,
    perps.view,
    portfolio.map,
    settings.currencyInfo.id,
  ]);
  const homeBalanceScopeKey = buildNativeHomeBalanceScopeKey({
    accountId: account?.id,
    networkId: network?.id,
    walletId: wallet?.id,
  });
  const hasNativeHomeHoldingsNow = useMemo(
    () =>
      hasNativeHomePortfolioHoldings({
        map: portfolio.map,
        riskMap: portfolio.riskMap,
        smallBalanceMap: portfolio.smallBalanceMap,
      }),
    [portfolio.map, portfolio.riskMap, portfolio.smallBalanceMap],
  );
  const hasCurrentNativeHomeHoldings =
    portfolio.balanceAuthority.scopeKey === homeBalanceScopeKey &&
    resolveNativeHomeFundedHoldings({
      accountId: account?.id,
      hasHoldingsNow: hasNativeHomeHoldingsNow,
      networkId: network?.id,
    });
  const lastConfirmedBalance = getNativeHomeLastConfirmedBalance({
    accountId: account?.id,
    byOwner: lastConfirmedBalanceByOwner,
    networkId: network?.id,
  });
  const lastConfirmedBalanceIsPositive =
    lastConfirmedBalance === undefined
      ? undefined
      : hasNativeHomeNonZeroWorth([lastConfirmedBalance]);
  const currentDeFiBalanceIsPositive =
    deFi.balanceAuthority.scopeKey === homeBalanceScopeKey &&
    hasNativeHomeNonZeroWorth(
      Object.values(deFi.protocolMap).map((protocol) => protocol.netWorth),
    );
  const currentPerpsBalanceIsPositive =
    perps.viewState === 'ready' &&
    hasNativeHomeNonZeroWorth([perps.view?.accountValueUsd]);
  const computedHomeBalanceState = resolveNativeHomeBalanceState({
    currentScopeKey: homeBalanceScopeKey,
    hasCurrentPositiveBalance:
      currentDeFiBalanceIsPositive || currentPerpsBalanceIsPositive,
    hasHoldings: hasCurrentNativeHomeHoldings,
    hasWallet: Boolean(wallet),
    lastConfirmedBalanceIsPositive,
    portfolioAuthority: portfolio.balanceAuthority,
  });
  const homeBalanceStickyRef = useRef<INativeHomeBalanceStickyState>({
    state: 'unknown',
    walletId: undefined,
  });
  const homeBalanceResolution = resolveNativeHomeWalletScopedBalanceState({
    computed: computedHomeBalanceState,
    previous: homeBalanceStickyRef.current,
    walletId: wallet?.id,
  });
  homeBalanceStickyRef.current = homeBalanceResolution.sticky;
  const homeBalanceState = homeBalanceResolution.state;
  const headerActionPresentation = useMemo(
    () => resolveNativeHomeHeaderActionPresentation(homeBalanceState),
    [homeBalanceState],
  );

  const positiveHeaderActions = useMemo<IHomeContainerAction[]>(
    () => [
      {
        id: 'send',
        title: intl.formatMessage({ id: ETranslations.global_send }),
        icon: 'send',
        actionId: 'home.header.send',
      },
      {
        id: 'receive',
        title: intl.formatMessage({ id: ETranslations.global_receive }),
        icon: 'receive',
        actionId: 'home.header.receive',
      },
      {
        id: 'buy',
        title: intl.formatMessage({ id: ETranslations.buy_and_sell }),
        icon: 'buy',
        actionId: 'home.header.buy',
      },
      {
        id: 'more',
        title: intl.formatMessage({ id: ETranslations.global_more }),
        icon: 'more',
        actionId: 'home.header.more',
      },
    ],
    [intl],
  );
  const headerActions = useMemo<IHomeContainerAction[]>(() => {
    if (homeBalanceState === 'zero') {
      return [
        {
          id: 'add-money',
          title: intl.formatMessage({ id: ETranslations.global_add_money }),
          icon: 'receive',
          actionId: 'home.header.receive',
        },
      ];
    }
    return positiveHeaderActions;
  }, [homeBalanceState, intl, positiveHeaderActions]);
  const headerActionLayout = headerActionPresentation.actionLayout;
  const headerActionRowHeight = headerActionPresentation.rowHeight;

  const headerBalanceActions = useMemo<IHomeContainerAction[]>(() => {
    const actions: IHomeContainerAction[] = [];
    if (vaultSettings?.hasFrozenBalance) {
      actions.push({
        id: 'balance-details',
        title: intl.formatMessage({
          id: ETranslations.balance_detail_button_balance,
        }),
        actionId: 'home.header.balanceDetails',
      });
    }
    return actions;
  }, [intl, vaultSettings]);

  const headerBalance = useMemo(
    () =>
      hideValue ? '••••' : formatters.formatFiat(headerBalanceValue.toFixed()),
    [formatters, headerBalanceValue, hideValue],
  );
  const headerBalanceParts = useMemo(() => {
    if (hideValue) {
      return { balance: headerBalance, balanceSecondary: undefined };
    }
    const match = headerBalance.match(/^(.*)([.,]\d+)$/);
    return match
      ? { balance: match[1], balanceSecondary: match[2] }
      : { balance: headerBalance, balanceSecondary: undefined };
  }, [headerBalance, hideValue]);

  const headerBanners = useMemo(
    () =>
      homeBalanceState === 'positive'
        ? banners.banners.map((banner) => ({
            id: banner.id,
            title: banner.title,
            subtitle: banner.description,
            imageUrl: banner.src,
            actionId: 'home.banner.open',
            dismissActionId: banner.closeable
              ? 'home.banner.dismiss'
              : undefined,
          }))
        : [],
    [banners.banners, homeBalanceState],
  );

  const tabShells = useMemo<IHomeContainerTab[]>(() => {
    if (!homeWalletCapabilityTabModel.shouldCommitTabs) {
      return [
        {
          id: 'portfolio',
          title: '',
          sections: [],
        },
      ];
    }
    return HOME_CONTAINER_TAB_IDS.filter((id) => {
      if (id === 'perps') {
        return homeWalletCapabilityTabModel.isPerpsVisible;
      }
      if (id === 'defi') {
        return homeWalletCapabilityTabModel.isDeFiVisible;
      }
      if (id === 'nft') {
        return isNFTEnabled;
      }
      return true;
    }).map((id) => {
      let toolbarAction: IHomeContainerAction | undefined;
      if (id === 'portfolio' && manageTokenEnabled) {
        toolbarAction = {
          id: 'manage-tokens',
          title: '',
          icon: 'manage',
          actionId: 'home.portfolio.manageTokens',
        };
      } else if (id === 'history') {
        toolbarAction = {
          id: 'history-filter',
          title: '',
          icon: 'filter',
          actionId: 'home.history.filter',
        };
      }
      return {
        id,
        title: tabTitles[id],
        toolbarAction,
        sections: [],
      };
    });
  }, [
    homeWalletCapabilityTabModel,
    isNFTEnabled,
    manageTokenEnabled,
    tabTitles,
  ]);
  const tabSectionsById = useMemo<
    Partial<Record<IHomeContainerTabId, IHomeContainerSection[]>>
  >(
    () => ({
      portfolio: portfolioSections,
      perps: perpsSections,
      defi: deFiSections,
      nft: nftSections,
      history: historySections,
    }),
    [
      deFiSections,
      historySections,
      nftSections,
      perpsSections,
      portfolioSections,
    ],
  );
  const latestTabSectionsRef = useRef(tabSectionsById);
  latestTabSectionsRef.current = tabSectionsById;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const initialAtomicTabState = buildHomeWalletAtomicTabState({
    tabShells,
    sectionsByTab: tabSectionsById,
    shouldCommitTabs: homeWalletCapabilityTabModel.shouldCommitTabs,
    selectedTabId: activeTabId,
  });
  const contentStateSlots = useMemo<
    NonNullable<IHomeContainerSlots['contentStates']>
  >(() => {
    if (!homeWalletCapabilityTabModel.shouldCommitTabs) {
      return {
        portfolio: {
          interaction: 'none',
          content: (
            <Stack flex={1} bg="$bgApp" pt="$4" pointerEvents="none">
              <ListLoading listCount={4} />
            </Stack>
          ),
        },
      };
    }
    const committedTabIds = new Set(tabShells.map(({ id }) => id));
    const slots: NonNullable<IHomeContainerSlots['contentStates']> = {};
    const setSlot = (
      tabId: IHomeContainerTabId,
      sections: IHomeContainerSection[],
      createContent: () => ReactNode,
    ) => {
      if (!committedTabIds.has(tabId)) {
        return;
      }
      const { content, height } = resolveNativeHomeListStateSlot(
        sections,
        createContent,
      );
      slots[tabId] = {
        height,
        interaction: height === undefined ? 'none' : 'tap',
        content: (
          <Stack flex={1} bg="$bgApp">
            {content}
          </Stack>
        ),
      };
    };

    setSlot('portfolio', portfolioAssetSections, () => {
      if (!visiblePortfolioInitialized) {
        return <ListLoading listCount={4} />;
      }
      if (hasNoUsableWallet) {
        return <EmptyWallet />;
      }
      if (!account || portfolio.isEmptyAccount) {
        return (
          <EmptyAccount
            autoCreateAddress
            createAllDeriveTypes
            createAllEnabledNetworks
            name={accountName ?? ''}
            chain={network?.name ?? ''}
            type={
              (deriveInfo?.labelKey
                ? intl.formatMessage({ id: deriveInfo.labelKey })
                : deriveInfo?.label) ?? ''
            }
          />
        );
      }
      return <EmptyToken />;
    });
    setSlot('perps', perpsSections, () => {
      if (perps.viewState === 'ready') {
        return null;
      }
      return (
        <PerpsHomeStateSlot
          viewState={perps.viewState}
          canDeposit={perps.canDeposit}
          isDepositDisabled={perps.isDepositDisabled}
          isActive={activeTabId === 'perps'}
        />
      );
    });
    setSlot('defi', deFiSections, () =>
      deFi.initialized ? <EmptyDeFi /> : <ListLoading listCount={4} />,
    );
    setSlot('nft', nftSections, () =>
      nft.initialized ? <EmptyNFT /> : <NFTListLoadingView />,
    );
    setSlot('history', historySections, () =>
      history.initialized ? (
        <EmptyHistory
          showViewInExplorer
          isActive={activeTabId === 'history'}
          walletId={wallet?.id}
          accountId={account?.id}
          networkId={network?.id}
          indexedAccountId={indexedAccount?.id}
          tokenMap={portfolio.map}
        />
      ) : (
        <HistoryLoadingView />
      ),
    );
    return slots;
  }, [
    account,
    accountName,
    activeTabId,
    deFi.initialized,
    deFiSections,
    deriveInfo?.label,
    deriveInfo?.labelKey,
    hasNoUsableWallet,
    history.initialized,
    historySections,
    indexedAccount?.id,
    intl,
    network?.id,
    network?.name,
    nft.initialized,
    nftSections,
    perps.canDeposit,
    perps.isDepositDisabled,
    perps.viewState,
    perpsSections,
    portfolio.isEmptyAccount,
    portfolio.map,
    portfolioAssetSections,
    tabShells,
    wallet?.id,
    visiblePortfolioInitialized,
    homeWalletCapabilityTabModel.shouldCommitTabs,
  ]);
  const nativeRef = useRef<IHomeContainerRef | null>(null);
  const slotActionRef = useRef<
    (actionId: string, itemId: string, tabId: string) => Promise<void>
  >(() => Promise.resolve());
  const accountRowSlot = useMemo(
    () => ({
      interaction: 'tap' as const,
      content: (
        <XStack flex={1} alignItems="center" justifyContent="space-between">
          <XStack flex={1} minWidth={0} gap="$3" alignItems="center">
            <AccountSelectorTriggerHome num={0} />
            <AccountSelectorActiveAccountHome
              num={0}
              showAccountAddress={false}
              showCopyButton
              showCreateAddressButton={false}
              showNoAddressTip={false}
            />
          </XStack>
          <XStack flexShrink={0} alignItems="center" justifyContent="flex-end">
            {network?.isAllNetworks && !isOthersWallet ? (
              <AllNetworksManagerTrigger num={0} unifiedMode />
            ) : (
              <NetworkSelectorTriggerHome
                num={0}
                size="small"
                recordNetworkHistoryEnabled
                hideOnNoAccount
                unifiedMode
              />
            )}
          </XStack>
        </XStack>
      ),
    }),
    [isOthersWallet, network?.isAllNetworks],
  );
  const balanceSlot = useMemo(
    () => ({
      interaction: 'tap' as const,
      content: (
        <XStack
          flex={1}
          alignItems="center"
          minWidth={0}
          onPress={() => {
            void slotActionRef.current(
              'home.header.balance',
              'balance',
              activeTabId,
            );
          }}
        >
          <SizableText
            flexShrink={1}
            minWidth={0}
            position="relative"
            top={11}
            fontSize={48}
            lineHeight={48}
            fontWeight={500}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {headerBalanceParts.balance}
          </SizableText>
          {headerBalanceParts.balanceSecondary ? (
            <SizableText
              flexShrink={0}
              color="$textDisabled"
              position="relative"
              top={11}
              fontSize={48}
              lineHeight={48}
              fontWeight={500}
              numberOfLines={1}
            >
              {headerBalanceParts.balanceSecondary}
            </SizableText>
          ) : null}
        </XStack>
      ),
    }),
    [
      activeTabId,
      headerBalanceParts.balance,
      headerBalanceParts.balanceSecondary,
    ],
  );
  const headerActionRowSlot = useMemo<
    IHomeContainerSlots['headerActionRow']
  >(() => {
    if (headerActionPresentation.slotKind === 'zero') {
      return {
        height: 82,
        interaction: 'tap' as const,
        content: (
          <NativeHomeZeroBalanceWalletActions
            accountId={account?.id ?? ''}
            flex={1}
          />
        ),
      };
    }
    const iconById = {
      buy: 'CurrencyDollarOutline',
      more: 'DotHorOutline',
      receive: 'ArrowBottomOutline',
      send: 'ArrowTopOutline',
    } as const;
    return {
      interaction: 'tap' as const,
      height: 62,
      content: (
        <XStack flex={1} gap="$2.5">
          {headerActions.map((action) => (
            <ActionItem
              key={action.id}
              icon={iconById[action.id as keyof typeof iconById]}
              label={action.title}
              onPress={() => {
                void slotActionRef.current(
                  action.actionId,
                  action.id,
                  activeTabId,
                );
              }}
            />
          ))}
        </XStack>
      ),
    };
  }, [account?.id, activeTabId, headerActionPresentation, headerActions]);
  const tabAccessorySlots = useMemo<
    NonNullable<IHomeContainerSlots['tabAccessories']>
  >(
    () => ({
      portfolio: {
        interaction: 'tap' as const,
        content: (
          <XStack flex={1} alignItems="center" justifyContent="center">
            <IconButton
              testID="native-home-manage-tokens"
              variant="tertiary"
              icon="SliderHorOutline"
              onPress={() => {
                void slotActionRef.current(
                  'home.portfolio.manageTokens',
                  'manage-tokens',
                  activeTabId,
                );
              }}
            />
          </XStack>
        ),
      },
      history: {
        interaction: 'tap' as const,
        content: (
          <XStack flex={1} alignItems="center" justifyContent="center">
            <IconButton
              testID="native-home-history-filter"
              variant="tertiary"
              icon="Filter1Outline"
              onPress={() => {
                void slotActionRef.current(
                  'home.history.filter',
                  'history-filter',
                  activeTabId,
                );
              }}
            />
          </XStack>
        ),
      },
    }),
    [activeTabId],
  );
  const deFiTotal = useMemo(
    () =>
      Object.values(deFi.protocolMap).reduce(
        (total, protocol) => total.plus(protocol.netWorth || 0),
        new BigNumber(0),
      ),
    [deFi.protocolMap],
  );
  const contentHeaderSlots = useMemo<
    NonNullable<IHomeContainerSlots['contentHeaders']>
  >(() => {
    const slots: NonNullable<IHomeContainerSlots['contentHeaders']> = {
      portfolio: {
        interaction: lpTokens.showLpTokenFilterSwitch ? 'tap' : 'none',
        content: (
          <RichBlockHeader
            title={intl.formatMessage({
              id: ETranslations.global_universal_search_tabs_tokens,
            })}
            headerActions={
              lpTokens.showLpTokenFilterSwitch ? (
                <TokenSelectorLpTokenSwitch
                  value={lpTokens.showLpTokensOnly}
                  onChange={lpTokens.setShowLpTokensOnly}
                  loading={lpTokens.isLoading}
                />
              ) : null
            }
            headerContainerProps={{ flex: 1, px: '$pagePadding' }}
          />
        ),
      },
      defi: {
        interaction: 'tap',
        content: (
          <RichBlockHeader
            withTitleSeparator
            title={intl.formatMessage({ id: ETranslations.global_earn })}
            subTitle={
              deFi.initialized ? (
                formatPortfolioTotal(
                  deFiTotal.toNumber(),
                  settings.currencyInfo.symbol,
                  hideValue,
                )
              ) : (
                <Skeleton.HeadingXl w={120} />
              )
            }
            subTitleProps={{ color: '$text' }}
            headerContainerProps={{ flex: 1, px: '$pagePadding' }}
          />
        ),
      },
    };
    if (perps.viewState === 'ready' && perps.view) {
      slots.perps = {
        interaction: 'tap',
        content: (
          <PerpsHomeHeaderSlot
            totalUsd={perps.view.accountValueUsd}
            isDegraded={perps.view.isDegraded}
            canDeposit={perps.canDeposit}
            isDepositDisabled={perps.isDepositDisabled}
          />
        ),
      };
    }
    return slots;
  }, [
    deFi.initialized,
    deFiTotal,
    hideValue,
    intl,
    lpTokens.isLoading,
    lpTokens.setShowLpTokensOnly,
    lpTokens.showLpTokenFilterSwitch,
    lpTokens.showLpTokensOnly,
    perps.canDeposit,
    perps.isDepositDisabled,
    perps.view,
    perps.viewState,
    settings.currencyInfo.symbol,
  ]);
  const handleOpenHistoryExplorer = useCallback(async () => {
    await openExplorer({
      accountId: account?.id,
      indexedAccountId: indexedAccount?.id,
      networkId: account?.createAtNetwork ?? network?.id,
      address: account?.address,
    });
  }, [
    account?.address,
    account?.createAtNetwork,
    account?.id,
    indexedAccount?.id,
    network?.id,
    openExplorer,
  ]);
  const contentFooterSlots = useMemo<
    NonNullable<IHomeContainerSlots['contentFooters']>
  >(() => {
    const shouldShowUpgrade =
      isPrimeAvailable &&
      !(user?.primeSubscription?.isActive && user.onekeyUserId);
    return {
      portfolio: {
        ...(shouldShowUpgrade
          ? {
              upgrade: {
                interaction: 'tap' as const,
                content: <Upgrade />,
              },
            }
          : {}),
        support: {
          interaction: 'tap',
          content: <SupportHub nativeSlot />,
        },
      },
      perps:
        perps.viewState !== 'loading'
          ? {
              ...(shouldShowUpgrade
                ? {
                    upgrade: {
                      interaction: 'tap' as const,
                      content: <Upgrade />,
                    },
                  }
                : {}),
              support: {
                interaction: 'tap',
                content: (
                  <SupportHub
                    nativeSlot
                    helpCenterTitle={intl.formatMessage({
                      id: ETranslations.perp_guide_title,
                    })}
                    helpCenterLink={HOME_PERPS_GUIDE_URL}
                  />
                ),
              },
            }
          : {},
      defi: {
        ...(shouldShowUpgrade
          ? {
              upgrade: {
                interaction: 'tap' as const,
                content: <Upgrade />,
              },
            }
          : {}),
        support: {
          interaction: 'tap',
          content: <SupportHub nativeSlot />,
        },
      },
      ...(platformEnv.isNativeIOS &&
      history.initialized &&
      history.data.length > 0 &&
      !history.hasMore &&
      !history.isLoadingMore &&
      (network?.isAllNetworks || !vaultSettings?.hideBlockExplorer)
        ? {
            history: {
              historyEnd: {
                interaction: 'tap' as const,
                content: (
                  <YStack
                    flex={1}
                    alignItems="center"
                    justifyContent="center"
                    gap="$2"
                    px="$pagePadding"
                  >
                    <SizableText
                      size="$bodySm"
                      color="$textSubdued"
                      textAlign="center"
                    >
                      {intl.formatMessage({
                        id: ETranslations.wallet_history_footer_view_full_history_in_explorer,
                      })}
                    </SizableText>
                    {!isOthersWallet &&
                    vaultSettings?.mergeDeriveAssetsEnabled ? (
                      <AddressTypeSelector
                        walletId={wallet?.id ?? ''}
                        networkId={network?.id ?? ''}
                        indexedAccountId={
                          indexedAccount?.id ?? account?.indexedAccountId ?? ''
                        }
                        renderSelectorTrigger={
                          <Button
                            testID="native-home-history-address-type-selector"
                            size="small"
                            variant="secondary"
                            onPress={() => {}}
                          >
                            {intl.formatMessage({
                              id: ETranslations.global_block_explorer,
                            })}
                          </Button>
                        }
                        onSelect={async ({ account: selectedAccount }) => {
                          await openExplorerAddressUrl({
                            networkId: network?.id,
                            address: selectedAccount?.address,
                          });
                        }}
                        doubleConfirm
                      />
                    ) : (
                      <Button
                        testID="native-home-history-explorer"
                        size="small"
                        variant="secondary"
                        iconAfter={
                          requiresNetworkSelection ? undefined : 'OpenOutline'
                        }
                        onPress={() => {
                          void handleOpenHistoryExplorer();
                        }}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_block_explorer,
                        })}
                      </Button>
                    )}
                  </YStack>
                ),
              },
            },
          }
        : {}),
    };
  }, [
    account?.indexedAccountId,
    handleOpenHistoryExplorer,
    history.data.length,
    history.hasMore,
    history.initialized,
    history.isLoadingMore,
    indexedAccount?.id,
    intl,
    isPrimeAvailable,
    isOthersWallet,
    network?.id,
    network?.isAllNetworks,
    perps.viewState,
    requiresNetworkSelection,
    user?.onekeyUserId,
    user?.primeSubscription?.isActive,
    vaultSettings?.hideBlockExplorer,
    vaultSettings?.mergeDeriveAssetsEnabled,
    wallet?.id,
  ]);
  const homeSlots = useMemo<IHomeContainerSlots>(() => {
    if (!homeWalletCapabilityTabModel.shouldCommitTabs) {
      return {
        backgroundColor: nativeTheme.backgroundColor,
        accountRow: accountRowSlot,
        balance: balanceSlot,
        headerActionRow: headerActionRowSlot,
        contentStates: contentStateSlots,
      };
    }
    return {
      backgroundColor: nativeTheme.backgroundColor,
      accountRow: accountRowSlot,
      balance: balanceSlot,
      contentFooters: contentFooterSlots,
      headerActionRow: headerActionRowSlot,
      contentHeaders: contentHeaderSlots,
      contentStates: contentStateSlots,
      tabAccessories: tabAccessorySlots,
    };
  }, [
    accountRowSlot,
    balanceSlot,
    contentFooterSlots,
    contentHeaderSlots,
    contentStateSlots,
    headerActionRowSlot,
    homeWalletCapabilityTabModel.shouldCommitTabs,
    nativeTheme.backgroundColor,
    tabAccessorySlots,
  ]);
  const controllerRef = useRef<HomeContainerController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new HomeContainerController({
      initialSnapshot: {
        schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
        revision: 0,
        selectedTabId: initialAtomicTabState.selectedTabId,
        header: {
          accountName: accountName ?? '',
          accountSubtitle: network?.name,
          accountImageUrl,
          accountActionId: 'home.header.account',
          copyActionId: account?.address ? 'home.header.copy' : undefined,
          networkName: network?.isAllNetworks ? undefined : network?.name,
          networkImageUrls: headerNetworkImageUrls,
          networkCount: headerNetworkCount,
          networkActionId: 'home.header.network',
          balance: headerBalanceParts.balance,
          balanceSecondary: headerBalanceParts.balanceSecondary,
          balanceActionId: 'home.header.balance',
          balanceActions: headerBalanceActions,
          actionLayout: headerActionLayout,
          actionRowHeight: headerActionRowHeight,
          actions: headerActions,
          banners: headerBanners,
        },
        tabs: initialAtomicTabState.tabs,
        theme: nativeTheme,
      },
    });
  }
  const controller = controllerRef.current;

  useEffect(() => {
    controller.updateTheme(nativeTheme);
  }, [controller, nativeTheme]);
  useEffect(() => {
    controller.updateHeader({
      accountName: accountName ?? '',
      accountSubtitle: network?.name,
      accountImageUrl,
      accountActionId: 'home.header.account',
      copyActionId: account?.address ? 'home.header.copy' : undefined,
      networkName: network?.isAllNetworks ? undefined : network?.name,
      networkImageUrls: headerNetworkImageUrls,
      networkCount: headerNetworkCount,
      networkActionId: 'home.header.network',
      balance: headerBalanceParts.balance,
      balanceSecondary: headerBalanceParts.balanceSecondary,
      balanceActionId: 'home.header.balance',
      balanceActions: headerBalanceActions,
      actionLayout: headerActionLayout,
      actionRowHeight: headerActionRowHeight,
      actions: headerActions,
      banners: headerBanners,
    });
  }, [
    account?.address,
    accountImageUrl,
    accountName,
    controller,
    headerActionLayout,
    headerActionRowHeight,
    headerActions,
    headerBalanceActions,
    headerBalanceParts.balance,
    headerBalanceParts.balanceSecondary,
    headerBanners,
    headerNetworkCount,
    headerNetworkImageUrls,
    network?.isAllNetworks,
    network?.name,
  ]);
  useLayoutEffect(() => {
    const nextTabState = buildHomeWalletAtomicTabState({
      tabShells,
      sectionsByTab: latestTabSectionsRef.current,
      shouldCommitTabs: homeWalletCapabilityTabModel.shouldCommitTabs,
      selectedTabId: activeTabIdRef.current,
    });
    controller.replaceSnapshot({
      ...controller.getSnapshot(),
      selectedTabId: nextTabState.selectedTabId,
      tabs: nextTabState.tabs,
    });
    if (nextTabState.selectedTabId !== activeTabIdRef.current) {
      setActiveTabId(nextTabState.selectedTabId);
    }
  }, [controller, homeWalletCapabilityTabModel.shouldCommitTabs, tabShells]);
  useEffect(() => {
    if (homeWalletCapabilityTabModel.shouldCommitTabs) {
      controller.updateTabSections('portfolio', portfolioSections);
    }
  }, [
    controller,
    homeWalletCapabilityTabModel.shouldCommitTabs,
    portfolioSections,
  ]);
  useEffect(() => {
    if (homeWalletCapabilityTabModel.shouldCommitTabs) {
      controller.updateTabSections('perps', perpsSections);
    }
  }, [
    controller,
    homeWalletCapabilityTabModel.shouldCommitTabs,
    perpsSections,
  ]);
  useEffect(() => {
    if (homeWalletCapabilityTabModel.shouldCommitTabs) {
      controller.updateTabSections('defi', deFiSections);
    }
  }, [controller, deFiSections, homeWalletCapabilityTabModel.shouldCommitTabs]);
  useEffect(() => {
    if (homeWalletCapabilityTabModel.shouldCommitTabs) {
      controller.updateTabSections('nft', nftSections);
    }
  }, [controller, homeWalletCapabilityTabModel.shouldCommitTabs, nftSections]);
  useEffect(() => {
    if (homeWalletCapabilityTabModel.shouldCommitTabs) {
      controller.updateTabSections('history', historySections);
    }
  }, [
    controller,
    historySections,
    homeWalletCapabilityTabModel.shouldCommitTabs,
  ]);
  useEffect(
    () => () => {
      controller.detach();
    },
    [controller],
  );

  const handleReady = useCallback(
    (capabilities: IHomeContainerCapabilities) => {
      if (nativeRef.current) {
        controller.attach(nativeRef.current, capabilities);
      }
    },
    [controller],
  );
  const handleVisibleTabChange = useCallback(
    (value: string) => {
      if (!isHomeTabId(value)) {
        return;
      }
      controller.recordSelectedTab(value);
      setActiveTabId(value);
    },
    [controller],
  );
  const handleRefresh = useCallback(
    (value: string, requestId: string) => {
      if (!isHomeTabId(value)) {
        nativeRef.current?.completeRefresh(requestId);
        return;
      }
      onHomePageRefresh();
      defaultLogger.account.wallet.walletPullToRefresh();
      let task: Promise<void>;
      switch (value) {
        case 'portfolio':
          task = Promise.all([
            portfolio.refresh(),
            lpTokens.refresh(),
            deFi.refresh(),
            banners.refresh(),
            supplemental.refresh(),
          ]).then(() => undefined);
          break;
        case 'perps':
          task = perps.refresh();
          break;
        case 'defi':
          task = deFi.refresh();
          break;
        case 'nft':
          task = nft.refresh();
          break;
        case 'history':
          task = history.refresh();
          break;
        default:
          task = Promise.resolve();
      }
      void task
        .catch(() => undefined)
        .finally(() => nativeRef.current?.completeRefresh(requestId));
    },
    [banners, deFi, history, lpTokens, nft, perps, portfolio, supplemental],
  );
  const handleAction = useCallback(
    async (actionId: string, itemId: string, tabId: string) => {
      onAction?.(actionId, itemId, tabId);
      if (actionId === 'home.header.account') {
        showAccountSelector();
        return;
      }
      if (actionId === 'home.header.network') {
        showUnifiedNetworkSelector({ recordNetworkHistoryEnabled: true });
        return;
      }
      if (actionId === 'home.header.balance') {
        setSettingsValue({ hideValue: !hideValue });
        return;
      }
      if (actionId === 'home.banner.open') {
        const banner = banners.banners.find((item) => item.id === itemId);
        if (banner) await banners.handleBannerOnPress(banner);
        return;
      }
      if (actionId === 'home.banner.dismiss') {
        const banner = banners.banners.find((item) => item.id === itemId);
        if (banner) await banners.dismiss(banner);
        return;
      }
      if (actionId.startsWith('home.widget.market.category:')) {
        setSelectedMarketCategoryId(
          actionId.slice('home.widget.market.category:'.length),
        );
        return;
      }
      if (actionId === 'home.widget.market.addRecommended') {
        try {
          const didAdd = await addRecommendedMarketTokens();
          if (didAdd) {
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.market_added_to_watchlist,
              }),
            });
          }
        } catch {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
          });
        }
        return;
      }
      if (actionId === 'home.widget.market.toggleRecommendation') {
        const token = supplementalMarket.find(
          (candidate) => getNativeMarketItemId(candidate) === itemId,
        );
        if (token) {
          toggleMarketRecommendation(token);
        }
        return;
      }
      if (actionId === 'home.widget.market.favorite') {
        const token = supplementalMarket.find(
          (candidate) => getNativeMarketItemId(candidate) === itemId,
        );
        if (!token) return;
        try {
          await toggleMarketFavorite(token);
        } catch {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
          });
        }
        return;
      }
      if (actionId === 'home.widget.market.token') {
        const token = supplementalMarket.find(
          (candidate) => getNativeMarketItemId(candidate) === itemId,
        );
        if (token?.perpsCoin) {
          navigateToPerps(token.perpsCoin);
          return;
        }
      }
      if (
        actionId === 'home.widget.market.token' ||
        actionId === 'home.widget.market.showMore'
      ) {
        if (resolvedMarketCategoryId === HOME_PERPS_HOT_CATEGORY_ID) {
          navigateToMarketTab({
            tabToSelect: EMarketHomeTab.Perps,
            perpsCategoryToSelect: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
          });
          return;
        }
        if (resolvedMarketCategoryId === FAVORITES_CATEGORY_ID) {
          navigateToMarketTab({ tabToSelect: EMarketHomeTab.Watchlist });
          return;
        }
        navigateToMarketTab({
          spotCategoryToSelect: resolvedMarketCategoryId,
        });
        return;
      }
      if (actionId === 'home.widget.earn') {
        await safePushToEarnRoute(navigation, ETabEarnRoutes.EarnHome);
        return;
      }
      if (actionId === NATIVE_HOME_ACTION_IDS.togglePortfolioAssetsExpanded) {
        setPortfolioAssetsExpanded((value) => !value);
        return;
      }
      if (actionId === NATIVE_HOME_ACTION_IDS.toggleDeFiExpanded) {
        setDeFiExpanded((value) => !value);
        return;
      }
      if (actionId === NATIVE_HOME_ACTION_IDS.togglePortfolioDeFiExpanded) {
        setPortfolioDeFiExpanded((value) => !value);
        return;
      }
      if (actionId === NATIVE_HOME_ACTION_IDS.openDeFiOverview) {
        nativeRef.current?.selectTab('defi', true);
        return;
      }
      if (actionId === 'home.history.filter') {
        Dialog.show({
          title: intl.formatMessage({ id: ETranslations.global_filter }),
          showFooter: false,
          renderContent: (
            <Stack>
              <ListItem
                title={intl.formatMessage({
                  id: ETranslations.wallet_history_settings_hide_risk_transaction_title,
                })}
                subtitle={
                  filterScamHistorySupported
                    ? intl.formatMessage({
                        id: ETranslations.wallet_history_settings_hide_risk_transaction_desc,
                      })
                    : intl.formatMessage(
                        {
                          id: ETranslations.wallet_history_settings_hide_risk_transaction_desc_unsupported,
                        },
                        { networkName: network?.name ?? '' },
                      )
                }
              >
                <Switch
                  testID="native-home-hide-risk-transactions"
                  size={ESwitchSize.small}
                  disabled={!filterScamHistorySupported}
                  value={
                    filterScamHistorySupported
                      ? settings.isFilterScamHistoryEnabled
                      : false
                  }
                  onChange={(value) => {
                    setSettings((previous) => ({
                      ...previous,
                      isFilterScamHistoryEnabled: Boolean(value),
                    }));
                    appEventBus.emit(
                      EAppEventBusNames.RefreshHistoryList,
                      undefined,
                    );
                  }}
                />
              </ListItem>
              <ListItem
                title={intl.formatMessage({
                  id: ETranslations.wallet_history_settings_hide_small_transaction_title,
                })}
                subtitle={intl.formatMessage({
                  id: ETranslations.wallet_history_settings_hide_small_transaction_desc,
                })}
              >
                <Switch
                  testID="native-home-hide-small-transactions"
                  size={ESwitchSize.small}
                  value={settings.isFilterLowValueHistoryEnabled}
                  onChange={(value) => {
                    setSettings((previous) => ({
                      ...previous,
                      isFilterLowValueHistoryEnabled: Boolean(value),
                    }));
                    appEventBus.emit(
                      EAppEventBusNames.RefreshHistoryList,
                      undefined,
                    );
                  }}
                />
              </ListItem>
            </Stack>
          ),
        });
        return;
      }
      if (!account || !network || !wallet) {
        return;
      }

      if (actionId === 'home.header.copy') {
        copyAddressWithDeriveType({
          address: account.address ?? '',
          deriveInfo,
          networkName: network.name,
        });
        return;
      }
      if (actionId === 'home.portfolio.manageTokens') {
        handleOnManageToken();
        return;
      }
      if (actionId === 'home.header.balanceDetails') {
        showBalanceDetailsDialog({
          accountId: account.id,
          networkId: network.id,
          indexedAccountId: indexedAccount?.id,
          deriveInfoItems,
          mergeDeriveAssetsEnabled:
            vaultSettings?.mergeDeriveAssetsEnabled ?? false,
          intl,
        });
        return;
      }
      if (actionId === 'home.header.resourceDetails') {
        showResourceDetailsDialog({
          accountId: account.id,
          networkId: network.id,
        });
        return;
      }
      if (actionId === 'home.portfolio.smallBalance') {
        navigation.pushModal(EModalRoutes.MainModal, {
          screen: EModalAssetListRoutes.TokenList,
          params: {
            title: intl.formatMessage({ id: ETranslations.low_value_assets }),
            accountId: account.id,
            networkId: network.id,
            walletId: wallet.id,
            tokenList: {
              tokens: portfolio.smallBalanceTokens,
              keys: portfolio.smallBalanceTokens
                .map((item) => item.$key)
                .join('_'),
              map: portfolio.smallBalanceMap,
            },
            deriveType,
            deriveInfo,
            hideValue,
            isAllNetworks: network.isAllNetworks,
            aggregateTokensListMap: {},
            aggregateTokensMap: {},
            accountAddress: account.address,
            allAggregateTokenMap: {},
            searchKeyLengthThreshold: 1,
          },
        });
        return;
      }
      if (actionId === 'home.portfolio.riskAssets') {
        navigation.pushModal(EModalRoutes.MainModal, {
          screen: EModalAssetListRoutes.RiskTokenManager,
          params: {
            accountId: account.id,
            networkId: network.id,
            walletId: wallet.id,
            indexedAccountId: indexedAccount?.id,
            tokenList: {
              tokens: portfolio.riskTokens,
              keys: 'risk',
              map: portfolio.riskMap,
            },
            deriveType,
            deriveInfo,
            isAllNetworks: network.isAllNetworks,
            hideValue,
            accountAddress: account.address,
          },
        });
        return;
      }
      if (actionId === 'home.header.more') {
        showWalletActionMore();
        return;
      }

      if (actionId === NATIVE_HOME_ACTION_IDS.openAsset) {
        const token = visiblePortfolioTokens.find(
          (item) => item.$key === itemId,
        );
        if (!token) {
          return;
        }
        const aggregateMap =
          await backgroundApiProxy.serviceToken.getLocalAggregateTokenListMap({
            accountId: account.id,
            networkId: network.id,
          });
        navigation.pushModal(EModalRoutes.MainModal, {
          screen: EModalAssetDetailRoutes.TokenDetails,
          params: {
            accountId: token.accountId ?? account.id,
            networkId: token.networkId ?? network.id,
            accountAddress: account.address ?? '',
            walletId: wallet.id,
            isAllNetworks: network.isAllNetworks,
            indexedAccountId: indexedAccount?.id ?? '',
            tokenInfo: token,
            aggregateTokens: aggregateMap[token.$key]?.tokens ?? [],
            tokenMap: visiblePortfolioTokenMap,
          },
        });
        return;
      }

      if (actionId === NATIVE_HOME_ACTION_IDS.openNFT) {
        const selectedNFT = nft.data.find(
          (item) =>
            `${item.networkId ?? ''}:${item.collectionAddress}:${item.itemId}` ===
            itemId,
        );
        if (!selectedNFT) {
          return;
        }
        navigation.pushModal(EModalRoutes.MainModal, {
          screen: EModalAssetDetailRoutes.NFTDetails,
          params: {
            networkId: selectedNFT.networkId ?? network.id,
            accountId: selectedNFT.accountId ?? account.id,
            walletId: wallet.id,
            collectionAddress: selectedNFT.collectionAddress,
            itemId: selectedNFT.itemId,
          },
        });
        return;
      }

      if (actionId === NATIVE_HOME_ACTION_IDS.openHistory) {
        const selectedHistory = history.data.find((item) => item.id === itemId);
        if (!selectedHistory) {
          return;
        }
        if (
          selectedHistory.decodedTx.status === EDecodedTxStatus.Pending &&
          selectedHistory.isLocalCreated
        ) {
          const localTx =
            await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
              accountId: selectedHistory.decodedTx.accountId,
              networkId: selectedHistory.decodedTx.networkId,
              historyId: selectedHistory.id,
            });
          if (!localTx || localTx.replacedNextId) {
            return;
          }
        }
        const openedPrivateSend = await maybeOpenPrivateSendHistoryDetail({
          historyTx: selectedHistory,
          navigation,
          accountId: selectedHistory.decodedTx.accountId,
          accountAddress: account.address,
          network,
          currencySymbol: settings.currencyInfo.symbol,
        });
        if (openedPrivateSend) {
          return;
        }
        navigation.pushModal(EModalRoutes.MainModal, {
          screen: EModalAssetDetailRoutes.HistoryDetails,
          params: {
            networkId: selectedHistory.decodedTx.networkId,
            accountId: selectedHistory.decodedTx.accountId,
            historyTx: selectedHistory,
            isAllNetworks: network.isAllNetworks,
          },
        });
        return;
      }
      if (actionId === NATIVE_HOME_ACTION_IDS.loadMoreHistory) {
        await loadMoreHistory();
        return;
      }

      if (
        actionId === NATIVE_HOME_ACTION_IDS.openDeFiProtocol ||
        actionId === NATIVE_HOME_ACTION_IDS.openDeFiPosition
      ) {
        const selectedProtocol = deFi.protocols.find((protocol) => {
          const protocolKey = defiUtils.buildProtocolMapKey({
            networkId: protocol.networkId,
            protocol: protocol.protocol,
          });
          return actionId === NATIVE_HOME_ACTION_IDS.openDeFiProtocol
            ? itemId === `protocol:${protocolKey}`
            : itemId.startsWith(`position:${protocolKey}:`);
        });
        if (!selectedProtocol) {
          return;
        }
        const protocolKey = defiUtils.buildProtocolMapKey({
          networkId: selectedProtocol.networkId,
          protocol: selectedProtocol.protocol,
        });
        navigation.pushModal(EModalRoutes.MainModal, {
          screen: EModalAssetDetailRoutes.DeFiProtocolDetails,
          params: {
            protocol: selectedProtocol,
            protocolInfo: deFi.protocolMap[protocolKey],
            accountId: selectedProtocol.accountId ?? account.id,
            indexedAccountId:
              selectedProtocol.indexedAccountId ?? indexedAccount?.id,
          },
        });
        return;
      }

      if (
        actionId === NATIVE_HOME_ACTION_IDS.openPerpsHolding ||
        actionId === NATIVE_HOME_ACTION_IDS.openPerpsPosition
      ) {
        const coin = itemId.split(':')[1];
        if (coin) {
          navigateToPerps(coin);
          return;
        }
      }
      if (actionId === NATIVE_HOME_ACTION_IDS.openPerps) {
        const coin = itemId.startsWith('perps-market:')
          ? itemId.slice('perps-market:'.length)
          : undefined;
        if (coin) {
          navigateToPerps(coin);
          return;
        }
        navigation.switchTab(ETabRoutes.Perp);
        return;
      }
      if (actionId === NATIVE_HOME_ACTION_IDS.openPerpsMarket) {
        navigateToMarketTab({
          tabToSelect: EMarketHomeTab.Perps,
          perpsCategoryToSelect: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
        });
        return;
      }

      if (actionId === 'home.header.receive') {
        navigation.pushModal(EModalRoutes.ReceiveModal, {
          screen: EModalReceiveRoutes.ReceiveSelector,
        });
        return;
      }
      if (actionId === 'home.header.send') {
        navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
          screen: EModalSignatureConfirmRoutes.TxSelectToken,
          params: {
            hideZeroBalanceTokens: true,
            keepDefaultZeroBalanceTokens: false,
            showDeFiTokenSwitch: true,
            aggregateTokenSelectorScreen:
              EModalSignatureConfirmRoutes.TxSelectAggregateToken,
            title: intl.formatMessage({
              id: ETranslations.global_select_crypto,
            }),
            searchPlaceholder: intl.formatMessage({
              id: ETranslations.global_search_asset,
            }),
            networkId: network.id,
            accountId: account.id,
            isAllNetworks: network.isAllNetworks,
            tokens: {
              data: portfolio.tokens,
              keys: portfolio.tokens.map((item) => item.$key).join(','),
              map: portfolio.map,
            },
            tokenListState: {
              initialized: portfolio.initialized,
              isRefreshing: portfolio.isRefreshing,
            },
            closeAfterSelect: false,
            onSelect: async (token: IToken) => {
              navigation.push(EModalSignatureConfirmRoutes.TxDataInput, {
                accountId: token.accountId ?? account.id,
                networkId: token.networkId ?? network.id,
                isNFT: false,
                token,
                isAllNetworks: network.isAllNetworks,
              });
            },
          },
        });
        return;
      }
      if (actionId === 'home.header.buy') {
        navigation.pushModal(EModalRoutes.FiatCryptoModal, {
          screen: EModalFiatCryptoRoutes.BuyModal,
          params: {
            networkId: network.id,
            accountId: account.id,
            tokens: portfolio.tokens,
            map: portfolio.map,
          },
        });
      }
    },
    [
      account,
      banners,
      copyAddressWithDeriveType,
      deFi.protocolMap,
      deFi.protocols,
      deriveInfo,
      deriveInfoItems,
      deriveType,
      filterScamHistorySupported,
      handleOnManageToken,
      history.data,
      hideValue,
      indexedAccount?.id,
      intl,
      loadMoreHistory,
      navigateToPerps,
      navigateToMarketTab,
      navigation,
      network,
      nft.data,
      onAction,
      portfolio.initialized,
      portfolio.isRefreshing,
      portfolio.map,
      portfolio.riskMap,
      portfolio.riskTokens,
      portfolio.smallBalanceMap,
      portfolio.smallBalanceTokens,
      portfolio.tokens,
      setSettings,
      setSettingsValue,
      settings.isFilterLowValueHistoryEnabled,
      settings.isFilterScamHistoryEnabled,
      settings.currencyInfo.symbol,
      showAccountSelector,
      showUnifiedNetworkSelector,
      showWalletActionMore,
      addRecommendedMarketTokens,
      resolvedMarketCategoryId,
      supplementalMarket,
      toggleMarketRecommendation,
      toggleMarketFavorite,
      wallet,
      vaultSettings?.mergeDeriveAssetsEnabled,
      visiblePortfolioTokenMap,
      visiblePortfolioTokens,
    ],
  );
  slotActionRef.current = handleAction;

  return (
    <HomeContainer
      ref={nativeRef}
      style={{ flex: 1 }}
      slots={homeSlots}
      debugOverlayEnabled={debugOverlayEnabled}
      onReady={handleReady}
      onAction={handleAction}
      onRefresh={handleRefresh}
      onVisibleTabChange={handleVisibleTabChange}
      onRenderError={onRenderError}
    />
  );
}
