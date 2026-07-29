import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Skeleton, Stack, XStack, useTheme } from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorActiveAccount';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerHome';
import { AllNetworksManagerTrigger } from '@onekeyhq/kit/src/components/AccountSelector/AllNetworksManagerTrigger';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { EmptyDeFi, EmptyNFT } from '@onekeyhq/kit/src/components/Empty';
import { EmptyHistory } from '@onekeyhq/kit/src/components/Empty/EmptyHistory';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
  showResourceDetailsDialog,
  useTronAccountResources,
} from '@onekeyhq/kit/src/components/Resource';
import { HomeTabSearchHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import { TxHistoryListFooter } from '@onekeyhq/kit/src/components/TxHistoryListView';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHomeDisplayModel } from '@onekeyhq/kit/src/hooks/useHomeBalanceState';
import { useManageToken } from '@onekeyhq/kit/src/hooks/useManageToken';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeFacts,
  useHomeInteraction,
  useHomeNavigation,
  useHomeResource,
  useHomeSection,
  useHomeSessionState,
  useHomeShell,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { formatPortfolioTotal } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/formatPortfolioTotal';
import { HomeTokenListProviderMirror } from '@onekeyhq/kit/src/views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { NotBackedUpEmpty } from '@onekeyhq/kit/src/views/Home/components/NotBakcedUp';
import {
  HOME_PERPS_GUIDE_URL,
  HOME_PERPS_HOT_CATEGORY_ID,
} from '@onekeyhq/kit/src/views/Home/components/PopularTrading/constants';
import { RichBlockHeader } from '@onekeyhq/kit/src/views/Home/components/RichBlock/RichBlockHeader';
import { SupportHub } from '@onekeyhq/kit/src/views/Home/components/SupportHub';
import { Upgrade } from '@onekeyhq/kit/src/views/Home/components/Upgrade';
import { WalletActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions';
import { createHomeAuthorityId } from '@onekeyhq/kit/src/views/Home/model/core/homeIdentity';
import {
  createHomeTabRenderState,
  isHomeTabRendered,
  markHomeTabRendered,
  reconcileHomeTabRenderOwner,
} from '@onekeyhq/kit/src/views/Home/model/navigation/homeTabRenderState';
import { useHomeSectionPayload } from '@onekeyhq/kit/src/views/Home/model/react/homeStoreHooks';
import { useHomeMarketIntents } from '@onekeyhq/kit/src/views/Home/model/react/useHomeMarketIntents';
import { useHomePortfolioIntents } from '@onekeyhq/kit/src/views/Home/model/react/useHomePortfolioIntents';
import {
  HOME_BANNER_ACTION_IDS,
  readHomeBannerStorePayload,
} from '@onekeyhq/kit/src/views/Home/model/sections/banner/homeBannerStoreModel';
import { HOME_HISTORY_ACTION_IDS } from '@onekeyhq/kit/src/views/Home/model/sections/history/homeHistoryStoreModel';
import { getHomeMarketTokenRowId } from '@onekeyhq/kit/src/views/Home/model/sections/market/homeMarketSourceAdapter';
import {
  HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID,
  resolveHomePortfolioLpTokenSwitch,
} from '@onekeyhq/kit/src/views/Home/model/sections/spot/homePortfolioControls';
import type { IHomeSectionId } from '@onekeyhq/kit/src/views/Home/model/semantic/homeSemanticTypes';
import { HOME_SECTION_ACTION_IDS } from '@onekeyhq/kit/src/views/Home/model/store/homeStoreCommandIds';
import type {
  IHomeStoreEffect,
  IHomeStoreIntent,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreTypes';
import type { INativeHomePageViewProps } from '@onekeyhq/kit/src/views/Home/NativeHomePageView.types';
import { HomeOverviewContainer } from '@onekeyhq/kit/src/views/Home/pages/HomeOverviewContainer';
import {
  PerpsHomeHeaderSlot,
  PerpsHomeStateSlot,
} from '@onekeyhq/kit/src/views/Home/pages/PerpsContainer';
import { TabHeaderSettings } from '@onekeyhq/kit/src/views/Home/pages/TabHeaderSettings';
import { HomeTestIDs } from '@onekeyhq/kit/src/views/Home/testIDs';
import { usePrimeAvailable } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimeAvailable';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HomeContainer,
  type IHomeContainerHeader,
  type IHomeContainerIntent,
  type IHomeContainerOwner,
  type IHomeContainerRef,
  type IHomeContainerSection,
  type IHomeContainerSlots,
  type IHomeContainerSnapshot,
  type IHomeContainerState,
  type IHomeContainerTab,
  type IHomeContainerTabId,
  type IHomeContainerTheme,
  parseHomeContainerIntent,
} from '@onekeyhq/native-components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalAssetListRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  type IHomeNativeExpandedState,
  type IHomeNativeMarketRecommendationState,
  type IMobileNativeHomePortfolioFilterPresentation,
  type IMobileNativeHomeTabTopology,
  MOBILE_NATIVE_HOME_BANNER_SKELETON_ID,
  MOBILE_NATIVE_HOME_MARKET_ACTION_IDS,
  MOBILE_NATIVE_HOME_MARKET_CATEGORY_ACTION_PREFIX,
  MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS,
  buildMobileNativeHomePortfolioPresentation,
  buildMobileNativeHomeViewModelSections,
  getDeFiTotal,
  resolveMobileNativeHomeActionLayout,
  resolveMobileNativeHomeActionRowHeight,
  resolveMobileNativeHomeBannerPresentation,
  resolveMobileNativeHomeBodySections,
  resolveMobileNativeHomePortfolioFilterPresentation,
  resolveMobileNativeHomePortfolioSections,
  resolveMobileNativeHomeTabTopology,
  shouldPresentMobileNativeHomePortfolioChrome,
} from './mobileNativeHomeViewModelAdapter';

const TAB_ORDER: readonly IHomeContainerTabId[] = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
];
const HOME_REFRESH_FEEDBACK_DURATION_MS = 1200;

const MOBILE_NATIVE_HOME_TRON_RESOURCE_ACTION_ID =
  'home.native.banner.openTronResource';
const MOBILE_NATIVE_HOME_ACTION_SKELETON_COUNT = 4;

function MobileNativeHomeActionRowSkeleton() {
  return (
    <XStack
      flex={1}
      width="100%"
      height="100%"
      gap="$2.5"
      pointerEvents="none"
      testID={HomeTestIDs.walletActionsSkeleton}
    >
      {Array.from({ length: MOBILE_NATIVE_HOME_ACTION_SKELETON_COUNT }).map(
        (_, index) => (
          <Stack
            key={index}
            flex={1}
            height="100%"
            testID={HomeTestIDs.walletActionsSkeletonItem(index)}
          >
            <Skeleton width="100%" height="100%" borderRadius="$4" />
          </Stack>
        ),
      )}
    </XStack>
  );
}

function isTabId(value: string): value is IHomeContainerTabId {
  return TAB_ORDER.some((tabId) => tabId === value);
}

function didAcceptIntent(effects: readonly IHomeStoreEffect[]): boolean {
  return !effects.some((effect) => effect.kind === 'traceReject');
}

function equal(left: unknown, right: unknown): boolean {
  return (
    stringUtils.stableStringify(left) === stringUtils.stableStringify(right)
  );
}

function countSectionItems(sections: IHomeContainerSection[]): number {
  return sections.reduce((count, section) => count + section.items.length, 0);
}

function headerContainsCommand(
  header: IHomeContainerHeader,
  commandId: string,
): boolean {
  return Boolean(
    header.accountActionId === commandId ||
    header.copyActionId === commandId ||
    header.networkActionId === commandId ||
    header.balanceActionId === commandId ||
    header.actions.some((action) => action.actionId === commandId) ||
    header.balanceActions?.some((action) => action.actionId === commandId) ||
    header.banners.some(
      (banner) =>
        banner.actionId === commandId || banner.dismissActionId === commandId,
    ),
  );
}

export function MobileNativeHomeRenderer(_props: INativeHomePageViewProps) {
  const intl = useIntl();
  const theme = useTheme();
  const navigation = useAppNavigation();
  const nativeRef = useRef<IHomeContainerRef>(null);
  const homeNativeDecisionKeyRef = useRef<string | undefined>(undefined);
  const homeNativeContentDecisionKeyRef = useRef<string | undefined>(undefined);
  const [expandedSections, setExpandedSections] =
    useState<IHomeNativeExpandedState>({
      defi: false,
      portfolioAssets: false,
      portfolioDeFi: false,
    });
  const [selectedRecommendedMarketRowIds, setSelectedRecommendedMarketRowIds] =
    useState<string[]>([]);
  const marketRecommendationSelectionKeyRef = useRef<string | undefined>(
    undefined,
  );
  const session = useHomeSessionState();
  const facts = useHomeFacts();
  const interaction = useHomeInteraction();
  const shell = useHomeShell();
  const homeNavigation = useHomeNavigation();
  const portfolioSection = useHomeSection('portfolio');
  const perpsSection = useHomeSection('perps');
  const defiSection = useHomeSection('defi');
  const nftSection = useHomeSection('nft');
  const historySection = useHomeSection('history');
  const marketSection = useHomeSection('market');
  const bannerResource = useHomeResource('banner');
  const portfolioResource = useHomeResource('portfolio');
  const displayModel = useHomeDisplayModel();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [settings] = useSettingsPersistAtom();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;
  const { setShowLpTokensOnly } = useHomePortfolioIntents();
  const {
    addRecommended: addRecommendedMarketTokens,
    selectCategory: selectMarketCategory,
    toggleFavorite: toggleMarketFavorite,
    viewMore: viewMoreMarket,
  } = useHomeMarketIntents();
  const { isPrimeAvailable } = usePrimeAvailable();
  const { user } = useOneKeyAuth();
  const {
    activeAccount: {
      account,
      deriveInfo,
      deriveType,
      indexedAccount,
      isOthersWallet,
      network,
      vaultSettings,
      wallet,
    },
  } = useActiveAccount({ num: 0 });
  const { handleOnManageToken } = useManageToken({
    accountId: account?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
  });
  const portfolioPayload = useHomeSectionPayload('portfolio');
  const requestedShowLpTokensOnly =
    interaction.sectionControls.portfolio?.[
      HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID
    ];
  const lpTokenSwitch = resolveHomePortfolioLpTokenSwitch({
    liveLoading: portfolioPayload?.isLpTokenSwitchLoading ?? false,
    liveValue: portfolioPayload?.showLpTokensOnly ?? false,
    requestedValue: requestedShowLpTokensOnly,
  });
  const perpsPayload = useHomeSectionPayload('perps');
  const defiPayload = useHomeSectionPayload('defi');
  const nftPayload = useHomeSectionPayload('nft');
  const historyPayload = useHomeSectionPayload('history');
  const isHistoryLoadingMore = interaction.pendingSectionCommands.some(
    (command) =>
      command.sectionId === 'history' &&
      command.type === 'sectionActionInvoked' &&
      command.actionId === HOME_HISTORY_ACTION_IDS.loadMore,
  );
  const marketPayload = useHomeSectionPayload('market');
  const bannerPayload =
    bannerResource.kind === 'ready' || bannerResource.kind === 'partial'
      ? readHomeBannerStorePayload(bannerResource.data)
      : undefined;
  const tronResource = bannerPayload?.tronResource;
  const tronAccountResource = useTronAccountResources({
    accountId: tronResource?.accountId ?? '',
    networkId: tronResource?.networkId ?? '',
    pollingInterval: 30_000,
    suppressErrors: true,
  });

  useEffect(() => {
    const recommendationRows =
      marketPayload?.favoriteMode === 'recommendation'
        ? marketPayload.rows.slice(0, 4)
        : [];
    const selectionKey =
      recommendationRows.length > 0 && session.ownerToken
        ? `${session.ownerToken.scopeKey}:${session.ownerToken.sessionId}:${
            marketPayload?.selectedCategoryId ?? ''
          }:${marketPayload?.favoriteMode ?? ''}`
        : undefined;
    if (!selectionKey) {
      marketRecommendationSelectionKeyRef.current = undefined;
      setSelectedRecommendedMarketRowIds((current) =>
        current.length > 0 ? [] : current,
      );
      return;
    }
    const availableIds = recommendationRows.map(getHomeMarketTokenRowId);
    if (marketRecommendationSelectionKeyRef.current !== selectionKey) {
      marketRecommendationSelectionKeyRef.current = selectionKey;
      setSelectedRecommendedMarketRowIds(availableIds);
      return;
    }
    const availableIdSet = new Set(availableIds);
    setSelectedRecommendedMarketRowIds((current) => {
      const next = current.filter((rowId) => availableIdSet.has(rowId));
      return equal(current, next) ? current : next;
    });
  }, [marketPayload, session.ownerToken]);

  useEffect(() => {
    setExpandedSections({
      defi: false,
      portfolioAssets: false,
      portfolioDeFi: false,
    });
  }, [
    portfolioPayload?.showLpTokensOnly,
    session.ownerToken?.scopeKey,
    session.ownerToken?.sessionId,
  ]);

  const owner = useMemo<IHomeContainerOwner | undefined>(() => {
    if (!session.ownerToken) {
      return undefined;
    }
    return {
      scopeKey: session.ownerToken.scopeKey,
      sessionId: session.ownerToken.sessionId,
    };
  }, [session.ownerToken]);
  const homeTabsOwnerKey = session.ownerToken?.scopeKey;
  const [homeTabRenderState, setHomeTabRenderState] = useState(() =>
    createHomeTabRenderState(homeTabsOwnerKey),
  );
  const markTabRendered = useCallback(
    (tabId: IHomeContainerTabId) => {
      setHomeTabRenderState((current) =>
        markHomeTabRendered(current, homeTabsOwnerKey, tabId),
      );
    },
    [homeTabsOwnerKey],
  );
  useLayoutEffect(() => {
    if (homeTabRenderState.ownerKey === homeTabsOwnerKey) {
      return;
    }
    setHomeTabRenderState((current) =>
      reconcileHomeTabRenderOwner(current, homeTabsOwnerKey),
    );
    nativeRef.current?.selectTab('portfolio', false);
  }, [homeTabRenderState.ownerKey, homeTabsOwnerKey]);
  const renderedTabIds = useMemo(
    () =>
      new Set(
        TAB_ORDER.filter((tabId) =>
          isHomeTabRendered(homeTabRenderState, homeTabsOwnerKey, tabId),
        ),
      ),
    [homeTabRenderState, homeTabsOwnerKey],
  );
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
    [theme],
  );

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
  const nativeLabels = useMemo(
    () => ({
      addTokenInstruction: intl.formatMessage({
        id: ETranslations.add_token_instruction,
      }),
      addTokenLabel: intl.formatMessage({ id: ETranslations.add_token_label }),
      approve: intl.formatMessage({ id: ETranslations.global_approve }),
      contract: intl.formatMessage({ id: ETranslations.global_contract }),
      earn: intl.formatMessage({ id: ETranslations.earn_title }),
      favoriteAdd: intl.formatMessage({
        id: ETranslations.market_add_to_favorites,
      }),
      favoriteRemove: intl.formatMessage({
        id: ETranslations.market_remove_from_favorites,
      }),
      hotMarkets: intl.formatMessage({
        id: ETranslations.perp_home_hot_markets__title,
      }),
      loading: intl.formatMessage({
        id: ETranslations.perp_token_selector_loading,
      }),
      long: intl.formatMessage({ id: ETranslations.perp_long }),
      lowValueAssets: intl.formatMessage({
        id: ETranslations.low_value_assets,
      }),
      margin: intl.formatMessage({ id: ETranslations.perp_position_margin }),
      market: intl.formatMessage({ id: ETranslations.global_market }),
      noData: intl.formatMessage({ id: ETranslations.global_no_data }),
      positions: intl.formatMessage({ id: ETranslations.earn_positions }),
      receive: intl.formatMessage({ id: ETranslations.global_receive }),
      revokeApprove: (symbol: string) =>
        intl.formatMessage(
          { id: ETranslations.global_revoke_approve },
          { symbol },
        ),
      riskAssets: (number: number) =>
        intl.formatMessage(
          { id: ETranslations.wallet_collapsed_risk_assets_number },
          { number },
        ),
      send: intl.formatMessage({ id: ETranslations.global_send }),
      short: intl.formatMessage({ id: ETranslations.perp_short }),
      showLess: intl.formatMessage({ id: ETranslations.global_show_less }),
      showMore: intl.formatMessage({ id: ETranslations.global_show_more }),
      statusFailed: intl.formatMessage({ id: ETranslations.global_failed }),
      statusPending: intl.formatMessage({ id: ETranslations.global_pending }),
      swap: intl.formatMessage({ id: ETranslations.global_swap }),
      tokens: intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_tokens,
      }),
      unableToLoad: intl.formatMessage({ id: ETranslations.global_failed }),
      unlimited: intl.formatMessage({
        id: ETranslations.swap_page_provider_approve_amount_un_limit,
      }),
      viewMore: intl.formatMessage({ id: ETranslations.global_view_more }),
    }),
    [intl],
  );
  const marketRecommendationState = useMemo<
    IHomeNativeMarketRecommendationState | undefined
  >(
    () =>
      marketPayload?.favoriteMode === 'recommendation'
        ? {
            actionTitle: intl.formatMessage(
              { id: ETranslations.market_add_number_tokens },
              { number: selectedRecommendedMarketRowIds.length },
            ),
            selectedRowIds: selectedRecommendedMarketRowIds,
          }
        : undefined,
    [intl, marketPayload?.favoriteMode, selectedRecommendedMarketRowIds],
  );

  const currentPortfolioPresentation = useMemo(
    () =>
      buildMobileNativeHomePortfolioPresentation(
        buildMobileNativeHomeViewModelSections({
          allNetworksBadgeImageUrl: network?.logoURI,
          expanded: expandedSections,
          fiatContext: {
            currencyMap,
            targetCurrencyId: settings.currencyInfo.id,
            targetCurrencyUnit: settings.currencyInfo.symbol,
          },
          formatActionLabel: (labelId) => intl.formatMessage({ id: labelId }),
          hideValue,
          isAllNetworks: Boolean(network?.isAllNetworks),
          labels: nativeLabels,
          locale: intl.locale,
          marketRecommendationState,
          marketSemantic: marketSection.value,
          payloads: {
            portfolio: portfolioPayload,
            defi: defiPayload,
            market: marketPayload,
          },
          portfolioAssetsLoading: lpTokenSwitch.loading,
          sectionId: 'portfolio',
          semantic: portfolioSection.value,
        }),
      ),
    [
      defiPayload,
      currencyMap,
      expandedSections,
      hideValue,
      intl,
      marketPayload,
      marketRecommendationState,
      marketSection.value,
      nativeLabels,
      network?.logoURI,
      network?.isAllNetworks,
      lpTokenSwitch.loading,
      portfolioPayload,
      portfolioSection.value,
      settings.currencyInfo.id,
      settings.currencyInfo.symbol,
    ],
  );
  const currentPortfolioSections = currentPortfolioPresentation.sections;
  const portfolioAssetItemIdByPresentationId =
    currentPortfolioPresentation.assetItemIdByPresentationId;
  const lastCommittedPortfolioSectionsRef = useRef<
    IHomeContainerSection[] | undefined
  >(undefined);
  // Match tab handoff semantics: owner loading is not a committed replacement
  // presentation. Keep the last Portfolio rows mounted but strip every command,
  // then let cached or live data reconfigure those same presentation identities.
  const portfolioSections = resolveMobileNativeHomePortfolioSections({
    current: currentPortfolioSections,
    lastCommitted: lastCommittedPortfolioSectionsRef.current,
    loading: portfolioSection.value.kind === 'loading',
  });
  const hasCommittedPortfolioPresentation = Boolean(
    portfolioSection.value.kind === 'ready' ||
    lastCommittedPortfolioSectionsRef.current,
  );
  const shouldPresentPortfolioChrome =
    shouldPresentMobileNativeHomePortfolioChrome({
      bodyPresentationKind: displayModel.body.kind,
      hasCommittedPresentation: hasCommittedPortfolioPresentation,
    });
  const portfolioOwnerLoading = portfolioSection.value.kind === 'loading';
  const currentPortfolioFilterPresentation = useMemo(
    () => ({
      show: Boolean(portfolioPayload?.showLpTokenFilterSwitch),
      value: lpTokenSwitch.value,
    }),
    [lpTokenSwitch.value, portfolioPayload?.showLpTokenFilterSwitch],
  );
  const lastCommittedPortfolioFilterPresentationRef = useRef<
    IMobileNativeHomePortfolioFilterPresentation | undefined
  >(undefined);
  const portfolioFilterPresentation =
    resolveMobileNativeHomePortfolioFilterPresentation({
      current: currentPortfolioFilterPresentation,
      lastCommitted: lastCommittedPortfolioFilterPresentationRef.current,
      loading: portfolioOwnerLoading,
    });
  useLayoutEffect(() => {
    if (portfolioSection.value.kind === 'ready' && !lpTokenSwitch.loading) {
      lastCommittedPortfolioSectionsRef.current = currentPortfolioSections;
      lastCommittedPortfolioFilterPresentationRef.current =
        currentPortfolioFilterPresentation;
    }
  }, [
    currentPortfolioFilterPresentation,
    currentPortfolioSections,
    lpTokenSwitch.loading,
    portfolioSection.value.kind,
  ]);
  const perpsSections = useMemo(
    () =>
      buildMobileNativeHomeViewModelSections({
        expanded: expandedSections,
        labels: nativeLabels,
        locale: intl.locale,
        payloads: { perps: perpsPayload, market: marketPayload },
        sectionId: 'perps',
        semantic: perpsSection.value,
      }),
    [
      expandedSections,
      intl.locale,
      marketPayload,
      nativeLabels,
      perpsPayload,
      perpsSection.value,
    ],
  );
  const defiSections = useMemo(
    () =>
      buildMobileNativeHomeViewModelSections({
        expanded: expandedSections,
        formatActionLabel: (labelId) => intl.formatMessage({ id: labelId }),
        labels: nativeLabels,
        locale: intl.locale,
        payloads: { defi: defiPayload },
        sectionTitle: defiPayload
          ? `${tabTitles.defi} · ${formatPortfolioTotal(
              getDeFiTotal(defiPayload),
              settings.currencyInfo.symbol,
              hideValue,
            )}`
          : undefined,
        sectionId: 'defi',
        semantic: defiSection.value,
      }),
    [
      defiPayload,
      defiSection.value,
      expandedSections,
      hideValue,
      intl,
      nativeLabels,
      settings.currencyInfo.symbol,
      tabTitles.defi,
    ],
  );
  const nftSections = useMemo(
    () =>
      buildMobileNativeHomeViewModelSections({
        labels: nativeLabels,
        locale: intl.locale,
        payloads: { nft: nftPayload, portfolio: portfolioPayload },
        sectionId: 'nft',
        semantic: nftSection.value,
      }),
    [intl.locale, nativeLabels, nftPayload, nftSection.value, portfolioPayload],
  );
  const historySections = useMemo(
    () =>
      buildMobileNativeHomeViewModelSections({
        historyLoadingMore: isHistoryLoadingMore,
        isAllNetworks: Boolean(network?.isAllNetworks),
        labels: nativeLabels,
        locale: intl.locale,
        payloads: { history: historyPayload },
        sectionId: 'history',
        semantic: historySection.value,
      }),
    [
      historyPayload,
      historySection.value,
      isHistoryLoadingMore,
      intl.locale,
      nativeLabels,
      network?.isAllNetworks,
    ],
  );
  const sectionsByTab = useMemo(
    () => ({
      portfolio: portfolioSections,
      perps: perpsSections,
      defi: defiSections,
      nft: nftSections,
      history: historySections,
    }),
    [
      defiSections,
      historySections,
      nftSections,
      perpsSections,
      portfolioSections,
    ],
  );
  const loadingSectionsByTab = useMemo<
    Record<IHomeContainerTabId, IHomeContainerSection[]>
  >(() => {
    const build = (tabId: IHomeContainerTabId) =>
      buildMobileNativeHomeViewModelSections({
        labels: nativeLabels,
        locale: intl.locale,
        payloads: {},
        sectionId: tabId,
        semantic: { kind: 'loading', placeholder: tabId },
      });
    return {
      portfolio: build('portfolio'),
      perps: build('perps'),
      defi: build('defi'),
      nft: build('nft'),
      history: build('history'),
    };
  }, [intl.locale, nativeLabels]);

  const currentTabTopology = useMemo<IMobileNativeHomeTabTopology | undefined>(
    () =>
      homeNavigation.value.kind === 'ready'
        ? {
            destinations: homeNavigation.value.destinations,
            tabIds: homeNavigation.value.tabs,
          }
        : undefined,
    [homeNavigation.value],
  );
  const lastCommittedTabTopologyRef = useRef<
    IMobileNativeHomeTabTopology | undefined
  >(undefined);
  const tabTopology = resolveMobileNativeHomeTabTopology({
    current: currentTabTopology,
    lastCommitted: lastCommittedTabTopologyRef.current,
    portfolioOnly: displayModel.navigation.kind === 'portfolioOnly',
  });
  useLayoutEffect(() => {
    if (currentTabTopology) {
      lastCommittedTabTopologyRef.current = currentTabTopology;
    }
  }, [currentTabTopology]);

  const tabs = useMemo<IHomeContainerTab[]>(() => {
    // Owner-scoped Store data must reset immediately, but pending capability
    // state is not a confirmed Spot-only topology. Keep the last committed
    // topology so native reuses its tabs/pages while the new owner renders
    // cached content or loading sections, then replace it when capability is ready.
    return TAB_ORDER.filter((tabId) => tabTopology.tabIds.includes(tabId)).map(
      (tabId) => {
        const destination =
          tabTopology.destinations?.[tabId] === 'web' ? 'handoff' : 'inline';
        if (destination === 'handoff') {
          return {
            id: tabId,
            title: tabTitles[tabId],
            destination,
            handoffCommandId: 'home.perps.openWeb',
            sections: [],
          };
        }
        return {
          id: tabId,
          title: tabTitles[tabId],
          destination,
          sections: renderedTabIds.has(tabId)
            ? resolveMobileNativeHomeBodySections({
                bodyPresentationKind: displayModel.body.kind,
                sections: sectionsByTab[tabId],
                tabId,
              })
            : loadingSectionsByTab[tabId],
        };
      },
    );
  }, [
    displayModel.body.kind,
    loadingSectionsByTab,
    renderedTabIds,
    sectionsByTab,
    tabTopology,
    tabTitles,
  ]);

  const balanceModel =
    displayModel.balance.kind === 'ready'
      ? displayModel.balance.balance
      : undefined;
  const isBackupRequired = displayModel.body.kind === 'backupPrompt';
  const hasBannerContent = Boolean(
    bannerPayload &&
    (bannerPayload.banners.length > 0 || bannerPayload.tronResource),
  );
  const bannerPresentation = resolveMobileNativeHomeBannerPresentation({
    bannerPolicyKind: displayModel.banner.kind,
    bannerResourceKind: bannerResource.kind,
    hasBannerContent,
  });
  const header = useMemo<IHomeContainerHeader>(() => {
    const actionLayout = resolveMobileNativeHomeActionLayout({
      actionPresentationKind: displayModel.actions.kind,
    });
    const actionRowHeight = resolveMobileNativeHomeActionRowHeight({
      actionLayout,
      isBackupRequired,
    });
    let banners: IHomeContainerHeader['banners'] = [];
    if (bannerPresentation === 'loading') {
      banners = [
        {
          id: MOBILE_NATIVE_HOME_BANNER_SKELETON_ID,
          title: '',
        },
      ];
    } else if (bannerPresentation === 'content') {
      banners = [
        ...(bannerPayload?.tronResource
          ? [
              {
                id: 'home-tron-resource',
                title: '',
                actionId: MOBILE_NATIVE_HOME_TRON_RESOURCE_ACTION_ID,
                resourceRows: [
                  {
                    label: intl.formatMessage({
                      id: ETranslations.global_energy,
                    }),
                    value: `${tronAccountResource.result?.energyAvailable?.toFixed() ?? '0'} / ${
                      tronAccountResource.result?.energyTotal?.toFixed() ?? '0'
                    }`,
                    progress:
                      tronAccountResource.result?.energyTotal?.isZero() ===
                      false
                        ? tronAccountResource.result.energyAvailable
                            .div(tronAccountResource.result.energyTotal)
                            .times(100)
                            .toNumber()
                        : 0,
                  },
                  {
                    label: intl.formatMessage({
                      id: ETranslations.global_bandwidth,
                    }),
                    value: `${tronAccountResource.result?.netAvailable?.toFixed() ?? '0'} / ${
                      tronAccountResource.result?.netTotal?.toFixed() ?? '0'
                    }`,
                    progress:
                      tronAccountResource.result?.netTotal?.isZero() === false
                        ? tronAccountResource.result.netAvailable
                            .div(tronAccountResource.result.netTotal)
                            .times(100)
                            .toNumber()
                        : 0,
                  },
                ],
              },
            ]
          : []),
        ...(bannerPayload?.banners ?? []).map((banner) => ({
          id: banner.id,
          title: banner.title,
          subtitle: banner.description,
          imageUrl: banner.src,
          actionId: HOME_BANNER_ACTION_IDS.open,
          dismissActionId: banner.closeable
            ? HOME_BANNER_ACTION_IDS.dismiss
            : undefined,
        })),
      ];
    }
    return {
      accountName: '',
      balance: '',
      actionRowHeight,
      actionLayout,
      actions: [],
      banners,
    };
  }, [
    bannerPresentation,
    bannerPayload?.banners,
    bannerPayload?.tronResource,
    displayModel.actions.kind,
    intl,
    isBackupRequired,
    tronAccountResource.result,
  ]);
  const shouldShowActionRowSkeleton = header.actionLayout === 'loading';

  const selectedTabId = useMemo<IHomeContainerTabId>(() => {
    const navigationTabId =
      homeNavigation.value.kind === 'ready'
        ? homeNavigation.value.selectedTabId
        : 'portfolio';
    const requested = renderedTabIds.has(navigationTabId)
      ? navigationTabId
      : 'portfolio';
    return tabs.some(
      (tab) => tab.id === requested && tab.destination === 'inline',
    )
      ? requested
      : (tabs.find((tab) => tab.destination === 'inline')?.id ?? 'portfolio');
  }, [homeNavigation.value, renderedTabIds, tabs]);

  const snapshot = useMemo<IHomeContainerSnapshot>(
    () => ({
      selectedTabId,
      header,
      tabs,
      theme: nativeTheme,
    }),
    [header, nativeTheme, selectedTabId, tabs],
  );

  const shouldShowUpgrade = Boolean(
    isPrimeAvailable &&
    !(user?.primeSubscription?.isActive && user.onekeyUserId),
  );
  const perpsCanDeposit = Boolean(perpsPayload?.address);
  const perpsDepositDisabled = accountUtils.isWatchingAccount({
    accountId: facts?.owner.accountId ?? '',
  });
  const isPerpsEmpty = perpsSection.value.kind === 'empty';
  const isHistoryEmpty =
    historySection.value.kind === 'empty' ||
    (historySection.value.kind === 'ready' &&
      (historyPayload?.data.length ?? 0) === 0);
  const shouldMountHistoryEndFooter = Boolean(
    renderedTabIds.has('history') &&
    (historyPayload?.data.length ?? 0) > 0 &&
    (isHistoryLoadingMore ||
      (!historyPayload?.hasMore &&
        (network?.isAllNetworks || !vaultSettings?.hideBlockExplorer))),
  );

  useEffect(() => {
    const decision = {
      selectedTab: selectedTabId,
      showTokenFilter: Boolean(portfolioPayload?.showLpTokenFilterSwitch),
      showPortfolioSettings: displayModel.body.kind === 'portfolio',
      showHistoryFilter: renderedTabIds.has('history'),
      showPerpsHeader:
        renderedTabIds.has('perps') &&
        Boolean(perpsPayload) &&
        perpsSection.value.kind === 'ready',
      showDeFiHeader: false,
      showUpgrade: shouldShowUpgrade,
      showSupport: true,
      portfolioItemCount: countSectionItems(portfolioSections),
      perpsItemCount: countSectionItems(perpsSections),
      deFiItemCount: countSectionItems(defiSections),
      nftState: nftSection.value.kind,
      nftItemCount: nftPayload?.data.length ?? 0,
      historyItemCount: countSectionItems(historySections),
      marketItemCount: marketPayload?.rows.length ?? 0,
      earnItemCount: marketPayload?.earnRows.length ?? 0,
    };
    const key = stringUtils.stableStringify(decision);
    if (homeNativeContentDecisionKeyRef.current === key) {
      return;
    }
    homeNativeContentDecisionKeyRef.current = key;
    defaultLogger.wallet.homeUi.homeNativeContentDecision(decision);
  }, [
    defiSections,
    displayModel.body.kind,
    historySections,
    marketPayload?.earnRows.length,
    marketPayload?.rows.length,
    nftPayload?.data.length,
    nftSection.value.kind,
    perpsPayload,
    perpsSection.value.kind,
    perpsSections,
    portfolioPayload?.showLpTokenFilterSwitch,
    portfolioSections,
    renderedTabIds,
    selectedTabId,
    shouldShowUpgrade,
  ]);

  const slots = useMemo<IHomeContainerSlots>(
    () => ({
      backgroundColor: nativeTheme.backgroundColor,
      accountRow: {
        interaction: 'tap',
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
            <XStack flexShrink={0} alignItems="center">
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
      },
      balance: {
        interaction: 'tap',
        content: (
          <HomeOverviewContainer
            nativeSlot
            balancePresentation={displayModel.balance}
            manualRefreshEnabled={!isBackupRequired}
          />
        ),
      },
      headerActionRow:
        displayModel.actions.kind === 'hidden'
          ? undefined
          : {
              interaction: 'tap',
              height: header.actionRowHeight,
              content: (
                <HomeTokenListProviderMirror>
                  {shouldShowActionRowSkeleton ? (
                    <MobileNativeHomeActionRowSkeleton />
                  ) : (
                    (displayModel.actions.kind === 'funded' ||
                      displayModel.actions.kind === 'zero') && (
                      <WalletActions actionFamily={displayModel.actions.kind} />
                    )
                  )}
                </HomeTokenListProviderMirror>
              ),
            },
      contentStates: {
        ...(displayModel.body.kind === 'backupPrompt'
          ? {
              portfolio: {
                interaction: 'tap',
                content: <NotBackedUpEmpty />,
                height: 320,
              },
            }
          : {}),
        ...(renderedTabIds.has('nft') &&
        (nftSection.value.kind === 'empty' || nftSection.value.kind === 'error')
          ? {
              nft: {
                interaction: 'none' as const,
                content: <EmptyNFT />,
                height: 360,
              },
            }
          : {}),
        ...(renderedTabIds.has('defi') &&
        (defiSection.value.kind === 'empty' ||
          defiSection.value.kind === 'error')
          ? {
              defi: {
                interaction: 'tap' as const,
                content: <EmptyDeFi tableLayout />,
                height: 360,
              },
            }
          : {}),
        ...(renderedTabIds.has('perps') && isPerpsEmpty
          ? {
              perps: {
                interaction: 'tap' as const,
                content: (
                  <PerpsHomeStateSlot
                    viewState="empty"
                    canDeposit={perpsCanDeposit}
                    isDepositDisabled={perpsDepositDisabled}
                  />
                ),
                height: 600,
              },
            }
          : {}),
        ...(renderedTabIds.has('history') && isHistoryEmpty
          ? {
              history: {
                interaction: 'tap' as const,
                content: (
                  <EmptyHistory
                    showViewInExplorer
                    walletId={wallet?.id}
                    accountId={account?.id}
                    networkId={network?.id}
                    indexedAccountId={indexedAccount?.id}
                    tokenMap={historyPayload?.tokenMap ?? {}}
                  />
                ),
                height: 360,
              },
            }
          : {}),
      },
      contentHeaders: {
        ...(shouldPresentPortfolioChrome
          ? {
              portfolio: {
                interaction:
                  portfolioFilterPresentation.show && !portfolioOwnerLoading
                    ? ('tap' as const)
                    : ('none' as const),
                content: (
                  <RichBlockHeader
                    title={nativeLabels.tokens}
                    headerActions={
                      portfolioFilterPresentation.show ? (
                        <TokenSelectorLpTokenSwitch
                          value={portfolioFilterPresentation.value}
                          loading={
                            portfolioOwnerLoading || lpTokenSwitch.loading
                          }
                          onChange={setShowLpTokensOnly}
                        />
                      ) : null
                    }
                    headerContainerProps={{ flex: 1, px: '$pagePadding' }}
                  />
                ),
              },
            }
          : {}),
        ...(renderedTabIds.has('perps') &&
        perpsSection.value.kind === 'ready' &&
        perpsPayload
          ? {
              perps: {
                interaction: 'tap' as const,
                content: (
                  <PerpsHomeHeaderSlot
                    totalUsd={perpsPayload.view.accountValueUsd}
                    isDegraded={perpsPayload.view.isDegraded}
                    canDeposit={perpsCanDeposit}
                    isDepositDisabled={perpsDepositDisabled}
                  />
                ),
              },
            }
          : {}),
      },
      tabAccessories: {
        ...(shouldPresentPortfolioChrome
          ? {
              portfolio: {
                interaction: portfolioOwnerLoading
                  ? ('none' as const)
                  : ('tap' as const),
                content: (
                  <TabHeaderSettings
                    nativeSlot
                    focusedTab={tabTitles.portfolio}
                  />
                ),
              },
            }
          : {}),
        ...(renderedTabIds.has('history')
          ? {
              history: {
                interaction: 'tap' as const,
                content: (
                  <TabHeaderSettings
                    nativeSlot
                    focusedTab={tabTitles.history}
                    historyIcon="Filter1Outline"
                  />
                ),
              },
            }
          : {}),
      },
      contentFooters: {
        ...(shouldPresentPortfolioChrome
          ? {
              portfolio: {
                ...(shouldShowUpgrade
                  ? {
                      upgrade: {
                        interaction: portfolioOwnerLoading
                          ? ('none' as const)
                          : ('tap' as const),
                        content: <Upgrade />,
                      },
                    }
                  : {}),
                support: {
                  interaction: portfolioOwnerLoading
                    ? ('none' as const)
                    : ('tap' as const),
                  content: <SupportHub nativeSlot />,
                },
              },
            }
          : {}),
        ...(renderedTabIds.has('perps') &&
        (perpsSection.value.kind === 'ready' || isPerpsEmpty)
          ? {
              perps: {
                ...(shouldShowUpgrade
                  ? {
                      upgrade: {
                        interaction: 'tap' as const,
                        content: <Upgrade />,
                      },
                    }
                  : {}),
                support: {
                  interaction: 'tap' as const,
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
              },
            }
          : {}),
        ...(renderedTabIds.has('defi')
          ? {
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
                  interaction: 'tap' as const,
                  content: <SupportHub nativeSlot />,
                },
              },
            }
          : {}),
        ...(shouldMountHistoryEndFooter
          ? {
              history: {
                historyEnd: {
                  interaction: isHistoryLoadingMore
                    ? ('none' as const)
                    : ('tap' as const),
                  content: (
                    <TxHistoryListFooter
                      showFooter
                      hasItems
                      accountId={account?.id}
                      networkId={network?.id}
                      walletId={wallet?.id}
                      indexedAccountId={indexedAccount?.id}
                      isLoadingMore={isHistoryLoadingMore}
                      hasMore={historyPayload?.hasMore ?? false}
                    />
                  ),
                },
              },
            }
          : {}),
      },
    }),
    [
      account?.id,
      lpTokenSwitch.loading,
      defiSection.value.kind,
      header.actionRowHeight,
      historyPayload?.hasMore,
      historyPayload?.tokenMap,
      indexedAccount?.id,
      intl,
      isBackupRequired,
      isOthersWallet,
      isHistoryEmpty,
      isHistoryLoadingMore,
      nativeTheme.backgroundColor,
      nativeLabels.tokens,
      network?.id,
      network?.isAllNetworks,
      nftSection.value.kind,
      perpsCanDeposit,
      perpsDepositDisabled,
      isPerpsEmpty,
      perpsPayload,
      perpsSection.value.kind,
      portfolioFilterPresentation,
      portfolioOwnerLoading,
      renderedTabIds,
      displayModel.actions.kind,
      displayModel.balance,
      displayModel.body.kind,
      shouldPresentPortfolioChrome,
      shouldMountHistoryEndFooter,
      shouldShowActionRowSkeleton,
      setShowLpTokensOnly,
      shouldShowUpgrade,
      tabTitles,
      wallet?.id,
    ],
  );
  const slotBundle = useMemo(
    () => (owner ? { owner, slots } : undefined),
    [owner, slots],
  );

  const nativeState = useMemo<IHomeContainerState | undefined>(
    () =>
      owner
        ? {
            owner,
            payload: {
              selectedTabId: snapshot.selectedTabId,
              header: snapshot.header,
              tabs: snapshot.tabs,
              theme: snapshot.theme,
            },
          }
        : undefined,
    [owner, snapshot],
  );
  const refreshFeedbackTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  const disposeNativeSession = useCallback(() => {
    refreshFeedbackTimersRef.current.forEach((timeoutId, requestId) => {
      clearTimeout(timeoutId);
      nativeRef.current?.completeRefresh(requestId);
    });
    refreshFeedbackTimersRef.current.clear();
  }, []);

  useEffect(() => () => disposeNativeSession(), [disposeNativeSession]);

  useEffect(() => {
    const value = homeNavigation.value;
    let networkScope: 'allNetworks' | 'singleNetwork' | 'unknown' = 'unknown';
    if (facts?.owner.network.kind === 'allNetworks') {
      networkScope = 'allNetworks';
    } else if (facts?.owner.network.kind === 'singleNetwork') {
      networkScope = 'singleNetwork';
    }
    let balanceState: 'zero' | 'positive' | 'unknown' = 'unknown';
    if (displayModel.fundingVerdict === 'zero') {
      balanceState = 'zero';
    } else if (displayModel.fundingVerdict === 'funded') {
      balanceState = 'positive';
    }
    let walletActionFamily: 'zero' | 'funded' | 'loading' = 'loading';
    if (displayModel.actions.kind === 'zero') {
      walletActionFamily = 'zero';
    } else if (displayModel.actions.kind === 'funded') {
      walletActionFamily = 'funded';
    }
    const bannerCount = bannerPayload?.banners.length ?? 0;
    const hasTronResource = Boolean(bannerPayload?.tronResource);
    const shouldShowBanner =
      bannerPresentation === 'content' && (bannerCount > 0 || hasTronResource);
    const showActionSlot = displayModel.actions.kind !== 'hidden';
    const showBackupSlot = displayModel.body.kind === 'backupPrompt';
    const decisionKey = stringUtils.stableStringify({
      balanceModel,
      displayModel,
      bannerCount,
      hasTronResource,
      bannerPayloadParsed: Boolean(bannerPayload),
      bannerResourceKind: bannerResource.kind,
      headerBalance: header.balance,
      headerBalanceSecondary: header.balanceSecondary,
      isBackupRequired,
      networkScope,
      portfolioResource,
      shouldShowBanner,
      value,
    });
    if (homeNativeDecisionKeyRef.current === decisionKey) {
      return;
    }
    homeNativeDecisionKeyRef.current = decisionKey;
    defaultLogger.wallet.homeUi.homeRendererDecision({
      renderer: 'native',
      reason: 'platformDefault',
      navigationKind: value.kind,
      selectedTab: value.kind === 'ready' ? value.selectedTabId : '',
      visibleTabs: value.kind === 'ready' ? value.tabs.join(',') : '',
      showSearchHeader: true,
      showAccountSlot: true,
      showActionSlot,
      showBackupSlot,
    });
    defaultLogger.wallet.homeUi.homeHeaderDecision({
      networkScope,
      balancePresentationKind: balanceModel ? 'ready' : 'loading',
      balanceTextLength:
        header.balance.length + (header.balanceSecondary?.length ?? 0),
      balanceState,
      bannerResourceKind: bannerResource.kind,
      bannerPayloadParsed: Boolean(bannerPayload),
      bannerCount,
      hasTronResource,
      hasWalletBannerContent: bannerCount > 0 || hasTronResource,
      showPositiveBanner: displayModel.banner.kind === 'eligible',
      shouldShowBanner,
      walletActionFamily,
      shouldShowWalletActions:
        displayModel.actions.kind === 'funded' ||
        displayModel.actions.kind === 'zero',
      isWalletNotBackedUp: displayModel.body.kind === 'backupPrompt',
    });
    defaultLogger.wallet.homeUi.homeBalanceDecision({
      networkScope,
      balancePresentationKind: balanceModel ? 'ready' : 'loading',
      balanceState,
      hasSemanticDisplayAmount: Boolean(balanceModel),
      showSkeleton: !balanceModel,
      isRefreshing:
        portfolioResource.kind === 'ready' || portfolioResource.kind === 'empty'
          ? portfolioResource.refresh === 'refreshing'
          : portfolioResource.kind === 'loading' ||
            portfolioResource.kind === 'partial',
    });
    defaultLogger.wallet.homeUi.homeTabDecision({
      networkScope,
      navigationKind: value.kind,
      visibleTabs: value.kind === 'ready' ? value.tabs.join(',') : '',
      selectedTab: value.kind === 'ready' ? value.selectedTabId : '',
      showPortfolio: value.kind === 'ready' && value.tabs.includes('portfolio'),
      showPerps: value.kind === 'ready' && value.tabs.includes('perps'),
      showDeFi: value.kind === 'ready' && value.tabs.includes('defi'),
      showNFT: value.kind === 'ready' && value.tabs.includes('nft'),
      showHistory: value.kind === 'ready' && value.tabs.includes('history'),
      perpsDestination:
        value.kind === 'ready'
          ? (value.perpsDestination ?? 'unavailable')
          : 'unavailable',
    });
  }, [
    balanceModel,
    bannerPayload,
    bannerPresentation,
    bannerResource.kind,
    displayModel,
    facts?.owner.network.kind,
    header.balance,
    header.balanceSecondary,
    homeNavigation.value,
    isBackupRequired,
    portfolioResource,
  ]);

  const dispatchTabIntent = useCallback(
    (tabId: IHomeContainerTabId) => {
      if (!facts) {
        return false;
      }
      return didAcceptIntent(
        dispatchHomeIntent({
          type: 'tabSelected',
          authority: {
            kind: 'tabApplicability',
            revision: homeNavigation.tabApplicabilityRevision,
          },
          intentId: createHomeAuthorityId('intent'),
          owner: facts.owner,
          sessionId: facts.ownerToken.sessionId,
          tabId,
        }),
      );
    },
    [dispatchHomeIntent, facts, homeNavigation.tabApplicabilityRevision],
  );
  const acceptTabSelection = useCallback(
    (tabId: IHomeContainerTabId) => {
      if (dispatchTabIntent(tabId)) {
        markTabRendered(tabId);
        return;
      }
      nativeRef.current?.selectTab(selectedTabId, false);
    },
    [dispatchTabIntent, markTabRendered, selectedTabId],
  );
  const dispatchNativeAction = useCallback(
    (intent: IHomeContainerIntent) => {
      if (!facts || intent.intent.kind !== 'action') {
        return;
      }
      let storeIntent: IHomeStoreIntent;
      if (headerContainsCommand(header, intent.intent.commandId)) {
        storeIntent = {
          type: 'headerActionInvoked',
          actionId: intent.intent.commandId,
          authority: {
            kind: 'shellCommands',
            revision: shell.shellCommandRevision,
          },
          execution: 'controller',
          intentId: intent.intentId,
          itemId: intent.intent.itemId,
          owner: facts.owner,
          sessionId: facts.ownerToken.sessionId,
        };
      } else {
        let targetSectionId: IHomeSectionId = selectedTabId;
        if (
          intent.intent.commandId === HOME_SECTION_ACTION_IDS.openDeFiProtocol
        ) {
          targetSectionId = 'defi';
        } else if (
          intent.intent.commandId === HOME_SECTION_ACTION_IDS.openMarket ||
          intent.intent.commandId === HOME_SECTION_ACTION_IDS.openEarn
        ) {
          targetSectionId = 'market';
        }
        const sectionCommandRevisions: Record<IHomeSectionId, number> = {
          portfolio: portfolioSection.sectionCommandRevision,
          perps: perpsSection.sectionCommandRevision,
          defi: defiSection.sectionCommandRevision,
          nft: nftSection.sectionCommandRevision,
          history: historySection.sectionCommandRevision,
          market: marketSection.sectionCommandRevision,
        };
        const targetRevision = sectionCommandRevisions[targetSectionId];
        const itemId =
          targetSectionId === 'portfolio' &&
          intent.intent.commandId === HOME_SECTION_ACTION_IDS.openAsset &&
          intent.intent.itemId
            ? (portfolioAssetItemIdByPresentationId[intent.intent.itemId] ??
              intent.intent.itemId)
            : intent.intent.itemId;
        storeIntent = {
          type: 'sectionActionInvoked',
          actionId: intent.intent.commandId,
          authority: {
            kind: 'sectionCommands',
            revision: targetRevision,
            sectionId: targetSectionId,
          },
          execution: 'controller',
          intentId: intent.intentId,
          itemId,
          owner: facts.owner,
          sectionId: targetSectionId,
          sessionId: facts.ownerToken.sessionId,
        };
      }
      dispatchHomeIntent(storeIntent);
    },
    [
      defiSection.sectionCommandRevision,
      dispatchHomeIntent,
      facts,
      header,
      historySection.sectionCommandRevision,
      marketSection.sectionCommandRevision,
      nftSection.sectionCommandRevision,
      perpsSection.sectionCommandRevision,
      portfolioSection.sectionCommandRevision,
      portfolioAssetItemIdByPresentationId,
      selectedTabId,
      shell.shellCommandRevision,
    ],
  );

  const openLowValueAssets = useCallback(() => {
    if (!account || !network || !wallet || !portfolioPayload) {
      return;
    }
    const tokens = portfolioPayload.smallBalanceTokens ?? [];
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenList,
      params: {
        title: intl.formatMessage({ id: ETranslations.low_value_assets }),
        helpText: [
          intl.formatMessage({
            id: ETranslations.low_value_assets_desc_out_of_range,
          }),
          intl.formatMessage({
            id: ETranslations.low_value_assets_desc,
          }),
        ],
        accountId: account.id,
        networkId: network.id,
        walletId: wallet.id,
        indexedAccountId: indexedAccount?.id,
        tokenList: {
          tokens,
          keys: tokens.map((token) => token.$key).join(','),
          map: portfolioPayload.smallBalanceMap ?? {},
        },
        deriveType,
        deriveInfo,
        hideValue,
        isAllNetworks: network.isAllNetworks,
        aggregateTokensListMap: portfolioPayload.aggregateTokenListMap,
        aggregateTokensMap: {},
        accountAddress: account.address,
        allAggregateTokenMap: portfolioPayload.allAggregateTokenMap,
        searchKeyLengthThreshold: 1,
      },
    });
  }, [
    account,
    deriveInfo,
    deriveType,
    hideValue,
    indexedAccount?.id,
    intl,
    navigation,
    network,
    portfolioPayload,
    wallet,
  ]);

  const openRiskAssets = useCallback(() => {
    if (!account || !network || !wallet || !portfolioPayload) {
      return;
    }
    const tokens = portfolioPayload.riskTokens ?? [];
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.RiskTokenManager,
      params: {
        accountId: account.id,
        networkId: network.id,
        walletId: wallet.id,
        tokenList: {
          tokens,
          keys: tokens.map((token) => token.$key).join(','),
          map: portfolioPayload.riskMap ?? {},
        },
        deriveType,
        deriveInfo,
        isAllNetworks: network.isAllNetworks,
        hideValue,
        accountAddress: account.address,
      },
    });
  }, [
    account,
    deriveInfo,
    deriveType,
    hideValue,
    navigation,
    network,
    portfolioPayload,
    wallet,
  ]);

  const handleRefreshIntent = useCallback(
    (_tabId: IHomeContainerTabId, requestId: string) => {
      if (!facts) {
        nativeRef.current?.completeRefresh(requestId);
        return;
      }
      let didStartRefresh = false;
      const sectionCommandRevisions: Record<IHomeContainerTabId, number> = {
        portfolio: portfolioSection.sectionCommandRevision,
        perps: perpsSection.sectionCommandRevision,
        defi: defiSection.sectionCommandRevision,
        nft: nftSection.sectionCommandRevision,
        history: historySection.sectionCommandRevision,
      };
      tabs.forEach((tab) => {
        const sectionId = tab.id;
        const effects = dispatchHomeIntent({
          type: 'sectionRefreshRequested',
          actionId: `home.${sectionId}.refresh`,
          authority: {
            kind: 'sectionCommands',
            revision: sectionCommandRevisions[sectionId],
            sectionId,
          },
          execution: 'controller',
          intentId: createHomeAuthorityId('intent'),
          owner: facts.owner,
          sectionId,
          sessionId: facts.ownerToken.sessionId,
        });
        if (didAcceptIntent(effects)) {
          didStartRefresh = true;
        }
      });
      if (!didStartRefresh) {
        nativeRef.current?.completeRefresh(requestId);
        return;
      }
      const timeoutId = setTimeout(() => {
        nativeRef.current?.completeRefresh(requestId);
        refreshFeedbackTimersRef.current.delete(requestId);
      }, HOME_REFRESH_FEEDBACK_DURATION_MS);
      refreshFeedbackTimersRef.current.set(requestId, timeoutId);
    },
    [
      defiSection.sectionCommandRevision,
      dispatchHomeIntent,
      facts,
      historySection.sectionCommandRevision,
      nftSection.sectionCommandRevision,
      perpsSection.sectionCommandRevision,
      portfolioSection.sectionCommandRevision,
      tabs,
    ],
  );

  const handleIntent = useCallback(
    (value: string) => {
      const parsed = parseHomeContainerIntent(value);
      if (!parsed) {
        return;
      }
      if (
        !owner ||
        parsed.owner.scopeKey !== owner.scopeKey ||
        parsed.owner.sessionId !== owner.sessionId
      ) {
        if (parsed.intent.kind === 'refresh') {
          nativeRef.current?.completeRefresh(parsed.intent.requestId);
        }
        return;
      }
      if (parsed.intent.kind === 'action') {
        const commandId = parsed.intent.commandId;
        if (commandId === MOBILE_NATIVE_HOME_TRON_RESOURCE_ACTION_ID) {
          const resource = bannerPayload?.tronResource;
          if (resource) {
            showResourceDetailsDialog({
              accountId: resource.accountId,
              networkId: resource.networkId,
            });
          }
          return;
        }
        if (
          commandId ===
          MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.openLowValueAssets
        ) {
          openLowValueAssets();
          return;
        }
        if (
          commandId ===
          MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.openRiskAssets
        ) {
          openRiskAssets();
          return;
        }
        if (
          commandId ===
          MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.openManageToken
        ) {
          if (!portfolioPayload?.showLpTokensOnly) {
            handleOnManageToken();
          }
          return;
        }
        if (
          commandId ===
          MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.togglePortfolioAssetsExpanded
        ) {
          setExpandedSections((current) => ({
            ...current,
            portfolioAssets: !current.portfolioAssets,
          }));
          return;
        }
        if (
          commandId ===
          MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.togglePortfolioDeFiExpanded
        ) {
          setExpandedSections((current) => ({
            ...current,
            portfolioDeFi: !current.portfolioDeFi,
          }));
          return;
        }
        if (
          commandId ===
          MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.toggleDeFiExpanded
        ) {
          setExpandedSections((current) => ({
            ...current,
            defi: !current.defi,
          }));
          return;
        }
        if (
          commandId.startsWith(MOBILE_NATIVE_HOME_MARKET_CATEGORY_ACTION_PREFIX)
        ) {
          selectMarketCategory(
            commandId.slice(
              MOBILE_NATIVE_HOME_MARKET_CATEGORY_ACTION_PREFIX.length,
            ),
          );
          return;
        }
        if (commandId === MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.toggleFavorite) {
          const itemId = parsed.intent.itemId;
          const record = [
            ...(marketPayload?.rows ?? []),
            ...(marketPayload?.perpsHotRows ?? []),
          ].find((candidate) => getHomeMarketTokenRowId(candidate) === itemId);
          if (record && marketPayload) {
            const checked = marketPayload.watchListItems.some((item) =>
              record.perpsCoin
                ? item.perpsCoin === record.perpsCoin
                : item.chainId === record.chainId &&
                  item.contractAddress.toLowerCase() ===
                    record.contractAddress.toLowerCase(),
            );
            void toggleMarketFavorite({
              checked,
              record,
              watchListItems: marketPayload.watchListItems,
            });
          }
          return;
        }
        if (
          commandId === MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.toggleRecommended
        ) {
          const itemId = parsed.intent.itemId;
          if (itemId) {
            setSelectedRecommendedMarketRowIds((current) =>
              current.includes(itemId)
                ? current.filter((rowId) => rowId !== itemId)
                : [...current, itemId],
            );
          }
          return;
        }
        if (commandId === MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.addRecommended) {
          const selectedIds = new Set(selectedRecommendedMarketRowIds);
          const selectedTokens = (marketPayload?.rows ?? [])
            .slice(0, 4)
            .filter((record) =>
              selectedIds.has(getHomeMarketTokenRowId(record)),
            );
          if (selectedTokens.length > 0) {
            void addRecommendedMarketTokens(selectedTokens);
          }
          return;
        }
        if (commandId === MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.viewMore) {
          const selectedCategory = marketPayload?.resolvedCategoryId;
          viewMoreMarket(
            selectedCategory === 'favorites' ? undefined : selectedCategory,
          );
          return;
        }
        if (commandId === MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.viewMorePerps) {
          viewMoreMarket(HOME_PERPS_HOT_CATEGORY_ID);
          return;
        }
      }
      if (parsed.intent.kind === 'selectTab') {
        acceptTabSelection(parsed.intent.tabId);
        return;
      }
      if (parsed.intent.kind === 'refresh' && isTabId(parsed.intent.tabId)) {
        handleRefreshIntent(parsed.intent.tabId, parsed.intent.requestId);
        return;
      }
      if (parsed.intent.kind === 'handoff') {
        if (!facts) {
          return;
        }
        const effects = dispatchHomeIntent({
          type: 'tabHandoffInvoked',
          actionId: parsed.intent.commandId,
          authority: {
            kind: 'tabApplicability',
            revision: homeNavigation.tabApplicabilityRevision,
          },
          intentId: parsed.intentId,
          owner: facts.owner,
          sessionId: facts.ownerToken.sessionId,
          tabId: parsed.intent.tabId,
        });
        if (didAcceptIntent(effects)) {
          navigation.switchTab(ETabRoutes.WebviewPerpTrade);
        }
        return;
      }
      dispatchNativeAction(parsed);
    },
    [
      acceptTabSelection,
      addRecommendedMarketTokens,
      bannerPayload?.tronResource,
      dispatchHomeIntent,
      dispatchNativeAction,
      facts,
      handleOnManageToken,
      handleRefreshIntent,
      homeNavigation.tabApplicabilityRevision,
      navigation,
      marketPayload,
      openLowValueAssets,
      openRiskAssets,
      owner,
      portfolioPayload?.showLpTokensOnly,
      selectMarketCategory,
      selectedRecommendedMarketRowIds,
      toggleMarketFavorite,
      viewMoreMarket,
    ],
  );

  const handleRenderError = useCallback((code: string, message: string) => {
    defaultLogger.app.error.log(
      `[NativeHome] render failed: code=${code}, message=${message}`,
    );
  }, []);

  if (!owner || !nativeState) {
    return null;
  }

  return (
    <Stack flex={1} bg="$bgApp">
      <HomeTabSearchHeader />
      <HomeContainer
        ref={nativeRef}
        state={nativeState}
        style={{ flex: 1 }}
        slotBundle={slotBundle}
        testID="NativeHomeContainer"
        onIntent={handleIntent}
        onRenderError={handleRenderError}
      />
    </Stack>
  );
}
