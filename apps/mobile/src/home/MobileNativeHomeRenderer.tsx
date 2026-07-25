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
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
  showResourceDetailsDialog,
  useTronAccountResources,
} from '@onekeyhq/kit/src/components/Resource';
import { HomeTabSearchHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { TokenSelectorLpTokenSwitch } from '@onekeyhq/kit/src/components/TokenSelectorFilter';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHomeBalancePresentation } from '@onekeyhq/kit/src/hooks/useHomeBalanceState';
import { useManageToken } from '@onekeyhq/kit/src/hooks/useManageToken';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeCommitIdentity,
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
import { useHomeSectionPayload } from '@onekeyhq/kit/src/views/Home/model/react/homeStoreHooks';
import { useHomeMarketIntents } from '@onekeyhq/kit/src/views/Home/model/react/useHomeMarketIntents';
import { useHomePortfolioIntents } from '@onekeyhq/kit/src/views/Home/model/react/useHomePortfolioIntents';
import {
  HOME_BANNER_ACTION_IDS,
  readHomeBannerStorePayload,
} from '@onekeyhq/kit/src/views/Home/model/sections/banner/homeBannerStoreModel';
import { getHomeMarketTokenRowId } from '@onekeyhq/kit/src/views/Home/model/sections/market/homeMarketSourceAdapter';
import { HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID } from '@onekeyhq/kit/src/views/Home/model/sections/spot/homePortfolioControls';
import {
  HOME_SECTION_ACTION_IDS,
  HOME_SHELL_ACTION_IDS,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreCommandIds';
import type {
  IHomeStoreEffect,
  IHomeStoreIntent,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreTypes';
import type { INativeHomePageViewProps } from '@onekeyhq/kit/src/views/Home/NativeHomePageView.types';
import { HomeOverviewContainer } from '@onekeyhq/kit/src/views/Home/pages/HomeOverviewContainer';
import { PerpsHomeHeaderSlot } from '@onekeyhq/kit/src/views/Home/pages/PerpsContainer';
import { TabHeaderSettings } from '@onekeyhq/kit/src/views/Home/pages/TabHeaderSettings';
import { HomeTestIDs } from '@onekeyhq/kit/src/views/Home/testIDs';
import { usePrimeAvailable } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimeAvailable';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HOME_CONTAINER_SCHEMA_VERSION,
  HOME_CONTAINER_SLOT_CONTRACT_REVISION,
  HomeContainer,
  HomeContainerController,
  type IHomeContainerCapabilities,
  type IHomeContainerHeader,
  type IHomeContainerIntentV3,
  type IHomeContainerOwner,
  type IHomeContainerRef,
  type IHomeContainerSection,
  type IHomeContainerSlotKey,
  type IHomeContainerSlots,
  type IHomeContainerSnapshot,
  type IHomeContainerTab,
  type IHomeContainerTabId,
  type IHomeContainerTheme,
  parseHomeContainerIntentV3,
  parseHomeContainerTransportResult,
} from '@onekeyhq/native-components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
  MOBILE_NATIVE_HOME_BANNER_SKELETON_ID,
  MOBILE_NATIVE_HOME_MARKET_ACTION_IDS,
  MOBILE_NATIVE_HOME_MARKET_CATEGORY_ACTION_PREFIX,
  MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS,
  buildMobileNativeHomeViewModelSections,
  getDeFiTotal,
  resolveMobileNativeHomeActionLayout,
  resolveMobileNativeHomeBannerPresentation,
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

function formatShellBalance({
  amount,
  currency,
  hidden,
}: {
  amount: string;
  currency: string;
  hidden: boolean;
}): string {
  if (hidden) {
    return '••••';
  }
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return '';
  }
  try {
    return new Intl.NumberFormat(undefined, {
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: 'currency',
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function navigationShell(tabs: IHomeContainerTab[]) {
  return tabs.map(({ sections: _sections, ...tab }) => tab);
}

function countSectionItems(sections: IHomeContainerSection[]): number {
  return sections.reduce((count, section) => count + section.items.length, 0);
}

function collectSlotRevisions(
  slots: IHomeContainerSlots,
): Record<string, number> {
  const revisions: Record<string, number> = {};
  const addSlot = (
    slot: { authority?: { slotId: string; slotRevision: number } } | undefined,
  ) => {
    if (slot?.authority) {
      revisions[slot.authority.slotId] = slot.authority.slotRevision;
    }
  };
  addSlot(slots.accountRow);
  addSlot(slots.balance);
  addSlot(slots.headerActionRow);
  Object.values(slots.contentHeaders ?? {}).forEach(addSlot);
  Object.values(slots.contentStates ?? {}).forEach(addSlot);
  Object.values(slots.tabAccessories ?? {}).forEach(addSlot);
  Object.values(slots.contentFooters ?? {}).forEach((footerSlots) => {
    Object.values(footerSlots ?? {}).forEach(addSlot);
  });
  return revisions;
}

export function MobileNativeHomeRenderer(_props: INativeHomePageViewProps) {
  const intl = useIntl();
  const theme = useTheme();
  const navigation = useAppNavigation();
  const nativeRef = useRef<IHomeContainerRef>(null);
  const nativeCapabilitiesRef = useRef<IHomeContainerCapabilities | undefined>(
    undefined,
  );
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
  const commitIdentity = useHomeCommitIdentity();
  const portfolioSection = useHomeSection('portfolio');
  const perpsSection = useHomeSection('perps');
  const defiSection = useHomeSection('defi');
  const nftSection = useHomeSection('nft');
  const historySection = useHomeSection('history');
  const marketSection = useHomeSection('market');
  const bannerResource = useHomeResource('banner');
  const portfolioResource = useHomeResource('portfolio');
  const reactBalancePresentation = useHomeBalancePresentation();
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
  const displayedShowLpTokensOnly =
    typeof requestedShowLpTokensOnly === 'boolean'
      ? requestedShowLpTokensOnly
      : (portfolioPayload?.showLpTokensOnly ?? false);
  const perpsPayload = useHomeSectionPayload('perps');
  const defiPayload = useHomeSectionPayload('defi');
  const nftPayload = useHomeSectionPayload('nft');
  const historyPayload = useHomeSectionPayload('history');
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

  const portfolioSections = useMemo(
    () =>
      buildMobileNativeHomeViewModelSections({
        allNetworksBadgeImageUrl: network?.logoURI,
        expanded: expandedSections,
        formatActionLabel: (labelId) => intl.formatMessage({ id: labelId }),
        isAllNetworks: Boolean(network?.isAllNetworks),
        labels: nativeLabels,
        locale: intl.locale,
        marketRecommendationState,
        payloads: {
          portfolio: portfolioPayload,
          defi: defiPayload,
          market: marketPayload,
        },
        sectionId: 'portfolio',
        semantic: portfolioSection.value,
      }),
    [
      defiPayload,
      expandedSections,
      intl,
      marketPayload,
      marketRecommendationState,
      nativeLabels,
      network?.logoURI,
      network?.isAllNetworks,
      portfolioPayload,
      portfolioSection.value,
    ],
  );
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

  const tabs = useMemo<IHomeContainerTab[]>(() => {
    const value = homeNavigation.value;
    const visibleTabs = value.kind === 'ready' ? value.tabs : ['portfolio'];
    return TAB_ORDER.filter((tabId) => visibleTabs.includes(tabId)).map(
      (tabId) => {
        const destination =
          value.kind === 'ready' && value.destinations?.[tabId] === 'web'
            ? 'handoff'
            : 'inline';
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
          sections: sectionsByTab[tabId],
        };
      },
    );
  }, [homeNavigation.value, sectionsByTab, tabTitles]);

  const balancePresentation =
    shell.value.kind === 'portfolio' ? shell.value.presentation : undefined;
  const balanceModel =
    balancePresentation?.kind === 'zero' ||
    balancePresentation?.kind === 'funded'
      ? balancePresentation.header.balance
      : undefined;
  const funded =
    balancePresentation?.kind === 'funded' ||
    balancePresentation?.kind === 'fundedPendingTotal';
  const isBackupRequired = shell.value.kind === 'backupRequired';
  const hasBannerContent = Boolean(
    bannerPayload &&
    (bannerPayload.banners.length > 0 || bannerPayload.tronResource),
  );
  const showPositiveBanner =
    funded && balancePresentation?.banner.kind === 'positive';
  const bannerPresentation = resolveMobileNativeHomeBannerPresentation({
    balancePresentationKind: balancePresentation?.kind,
    bannerResourceKind: bannerResource.kind,
    hasBannerContent,
    isBackupRequired,
    showPositiveBanner,
  });
  const header = useMemo<IHomeContainerHeader>(() => {
    const balance = balanceModel
      ? formatShellBalance({
          amount: balanceModel.amount,
          currency: balanceModel.currency,
          hidden: hideValue,
        })
      : '';
    const match = hideValue ? undefined : balance.match(/^(.*)([.,]\d+)$/);
    const actionLayout = resolveMobileNativeHomeActionLayout({
      actionPresentationKind: balancePresentation?.actions.kind,
      isBackupRequired,
    });
    let actionRowHeight = 62;
    if (isBackupRequired) {
      actionRowHeight = 0;
    } else if (reactBalancePresentation.balanceState === 'zero') {
      actionRowHeight = 98;
    }
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
      balance: match?.[1] ?? balance,
      balanceSecondary: match?.[2],
      balanceActionId: balanceModel ? HOME_SHELL_ACTION_IDS.balance : undefined,
      actionRowHeight,
      actionLayout,
      actions: [],
      banners,
    };
  }, [
    balanceModel,
    balancePresentation?.actions.kind,
    bannerPresentation,
    bannerPayload?.banners,
    bannerPayload?.tronResource,
    hideValue,
    intl,
    isBackupRequired,
    reactBalancePresentation.balanceState,
    tronAccountResource.result,
  ]);
  const shouldShowActionRowSkeleton = header.actionLayout === 'loading';

  const selectedTabId = useMemo<IHomeContainerTabId>(() => {
    const requested =
      homeNavigation.value.kind === 'ready'
        ? homeNavigation.value.selectedTabId
        : 'portfolio';
    return tabs.some(
      (tab) => tab.id === requested && tab.destination === 'inline',
    )
      ? requested
      : (tabs.find((tab) => tab.destination === 'inline')?.id ?? 'portfolio');
  }, [homeNavigation.value, tabs]);

  const snapshot = useMemo<IHomeContainerSnapshot>(
    () => ({
      schemaVersion: HOME_CONTAINER_SCHEMA_VERSION,
      revision: 0,
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

  const accountRowAuthority = useMemo(
    () =>
      owner
        ? {
            owner,
            producedByStoreCommitId: commitIdentity.storeCommitId,
            slotId: 'header.account-row' as IHomeContainerSlotKey,
            slotRevision: 1,
          }
        : undefined,
    // The account selector owns its internal React state. Its Home slot
    // identity only changes when the Home owner changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner?.scopeKey, owner?.sessionId],
  );
  const balanceAuthority = useMemo(
    () =>
      owner
        ? {
            owner,
            producedByStoreCommitId: commitIdentity.storeCommitId,
            slotId: 'header.balance' as IHomeContainerSlotKey,
            slotRevision: shell.presentationRevision,
          }
        : undefined,
    // The balance slot changes with the Shell slice while its React content
    // continues to own hide-value interaction and number formatting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner?.scopeKey, owner?.sessionId, shell.presentationRevision],
  );
  const actionRowAuthority = useMemo(
    () =>
      owner && !isBackupRequired
        ? {
            owner,
            producedByStoreCommitId: commitIdentity.storeCommitId,
            slotId: 'header.action-row' as IHomeContainerSlotKey,
            slotRevision: shell.presentationRevision,
          }
        : undefined,
    // The action slot changes only with the Shell slice. Unrelated section
    // commits must not rebuild WalletActions or advance its slot revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isBackupRequired,
      owner?.scopeKey,
      owner?.sessionId,
      shell.presentationRevision,
    ],
  );
  const backupStateAuthority = useMemo(
    () =>
      owner && isBackupRequired
        ? {
            owner,
            producedByStoreCommitId: commitIdentity.storeCommitId,
            slotId: 'content.state.portfolio' as IHomeContainerSlotKey,
            slotRevision: shell.presentationRevision,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isBackupRequired,
      owner?.scopeKey,
      owner?.sessionId,
      shell.presentationRevision,
    ],
  );
  const portfolioHeaderAuthority = useMemo(
    () =>
      owner
        ? {
            owner,
            producedByStoreCommitId: commitIdentity.storeCommitId,
            slotId: 'content.header.portfolio' as IHomeContainerSlotKey,
            slotRevision: portfolioSection.presentationRevision,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner?.scopeKey, owner?.sessionId, portfolioSection.presentationRevision],
  );
  const perpsHeaderAuthority = useMemo(
    () =>
      owner && perpsPayload
        ? {
            owner,
            producedByStoreCommitId: commitIdentity.storeCommitId,
            slotId: 'content.header.perps' as IHomeContainerSlotKey,
            slotRevision: perpsSection.presentationRevision,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      owner?.scopeKey,
      owner?.sessionId,
      perpsPayload,
      perpsSection.presentationRevision,
    ],
  );
  const nftStateAuthority = useMemo(
    () =>
      owner &&
      (nftSection.value.kind === 'empty' || nftSection.value.kind === 'error')
        ? {
            owner,
            producedByStoreCommitId: commitIdentity.storeCommitId,
            slotId: 'content.state.nft' as IHomeContainerSlotKey,
            slotRevision: nftSection.presentationRevision,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      nftSection.presentationRevision,
      nftSection.value.kind,
      owner?.scopeKey,
      owner?.sessionId,
    ],
  );
  const deFiStateAuthority = useMemo(
    () =>
      owner && platformEnv.isNativeAndroid && defiSection.value.kind === 'empty'
        ? {
            owner,
            producedByStoreCommitId: commitIdentity.storeCommitId,
            slotId: 'content.state.defi' as IHomeContainerSlotKey,
            slotRevision: defiSection.presentationRevision,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      defiSection.presentationRevision,
      defiSection.value.kind,
      owner?.scopeKey,
      owner?.sessionId,
    ],
  );
  const portfolioAccessoryAuthority = useMemo(
    () =>
      owner
        ? {
            owner,
            producedByStoreCommitId: commitIdentity.storeCommitId,
            slotId: 'tab.accessory.portfolio' as IHomeContainerSlotKey,
            slotRevision: 1,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner?.scopeKey, owner?.sessionId],
  );
  const historyAccessoryAuthority = useMemo(
    () =>
      owner
        ? {
            owner,
            producedByStoreCommitId: commitIdentity.storeCommitId,
            slotId: 'tab.accessory.history' as IHomeContainerSlotKey,
            slotRevision: 1,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner?.scopeKey, owner?.sessionId],
  );

  const footerAuthorities = useMemo(() => {
    if (!owner) {
      return {
        portfolioUpgrade: undefined,
        portfolioSupport: undefined,
        perpsUpgrade: undefined,
        perpsSupport: undefined,
        defiUpgrade: undefined,
        defiSupport: undefined,
      };
    }
    const build = (
      tabId: 'portfolio' | 'perps' | 'defi',
      footerId: 'upgrade' | 'support',
    ) => ({
      owner,
      producedByStoreCommitId: commitIdentity.storeCommitId,
      slotId: `content.footer.${tabId}.${footerId}` as IHomeContainerSlotKey,
      slotRevision: 1,
    });
    return {
      portfolioUpgrade: build('portfolio', 'upgrade'),
      portfolioSupport: build('portfolio', 'support'),
      perpsUpgrade: build('perps', 'upgrade'),
      perpsSupport: build('perps', 'support'),
      defiUpgrade: build('defi', 'upgrade'),
      defiSupport: build('defi', 'support'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner?.scopeKey, owner?.sessionId]);

  useEffect(() => {
    const decision = {
      selectedTab: selectedTabId,
      showTokenFilter: Boolean(portfolioPayload?.showLpTokenFilterSwitch),
      showPortfolioSettings: Boolean(portfolioAccessoryAuthority),
      showHistoryFilter: Boolean(historyAccessoryAuthority),
      showPerpsHeader: Boolean(perpsHeaderAuthority),
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
    historyAccessoryAuthority,
    historySections,
    marketPayload?.earnRows.length,
    marketPayload?.rows.length,
    nftPayload?.data.length,
    nftSection.value.kind,
    perpsHeaderAuthority,
    perpsSections,
    portfolioAccessoryAuthority,
    portfolioPayload?.showLpTokenFilterSwitch,
    portfolioSections,
    selectedTabId,
    shouldShowUpgrade,
  ]);

  const slots = useMemo<IHomeContainerSlots>(
    () => ({
      backgroundColor: nativeTheme.backgroundColor,
      accountRow: {
        interaction: 'tap',
        authority: accountRowAuthority,
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
        authority: balanceAuthority,
        content: (
          <HomeOverviewContainer
            nativeSlot
            balancePresentation={reactBalancePresentation.correlated}
          />
        ),
      },
      headerActionRow: isBackupRequired
        ? undefined
        : {
            interaction: 'tap',
            authority: actionRowAuthority,
            height: header.actionRowHeight,
            content: (
              <HomeTokenListProviderMirror>
                {shouldShowActionRowSkeleton ? (
                  <MobileNativeHomeActionRowSkeleton />
                ) : (
                  <WalletActions
                    balancePresentation={reactBalancePresentation}
                  />
                )}
              </HomeTokenListProviderMirror>
            ),
          },
      contentStates: {
        ...(backupStateAuthority
          ? {
              portfolio: {
                interaction: 'tap',
                authority: backupStateAuthority,
                content: <NotBackedUpEmpty />,
                height: 320,
              },
            }
          : {}),
        ...(nftStateAuthority
          ? {
              nft: {
                interaction: 'none' as const,
                authority: nftStateAuthority,
                content: <EmptyNFT />,
                height: 360,
              },
            }
          : {}),
        ...(deFiStateAuthority
          ? {
              defi: {
                interaction: 'tap' as const,
                authority: deFiStateAuthority,
                content: <EmptyDeFi tableLayout />,
                height: 360,
              },
            }
          : {}),
      },
      contentHeaders: {
        portfolio: {
          interaction: portfolioPayload?.showLpTokenFilterSwitch
            ? 'tap'
            : 'none',
          authority: portfolioHeaderAuthority,
          content: (
            <RichBlockHeader
              title={nativeLabels.tokens}
              headerActions={
                portfolioPayload?.showLpTokenFilterSwitch ? (
                  <TokenSelectorLpTokenSwitch
                    value={displayedShowLpTokensOnly}
                    loading={portfolioPayload.isLpTokenSwitchLoading}
                    onChange={setShowLpTokensOnly}
                  />
                ) : null
              }
              headerContainerProps={{ flex: 1, px: '$pagePadding' }}
            />
          ),
        },
        ...(perpsHeaderAuthority && perpsPayload
          ? {
              perps: {
                interaction: 'tap' as const,
                authority: perpsHeaderAuthority,
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
        portfolio: {
          interaction: 'tap',
          authority: portfolioAccessoryAuthority,
          content: (
            <TabHeaderSettings nativeSlot focusedTab={tabTitles.portfolio} />
          ),
        },
        history: {
          interaction: 'tap',
          authority: historyAccessoryAuthority,
          content: (
            <TabHeaderSettings
              nativeSlot
              focusedTab={tabTitles.history}
              historyIcon="Filter1Outline"
            />
          ),
        },
      },
      contentFooters: {
        portfolio: {
          ...(shouldShowUpgrade
            ? {
                upgrade: {
                  interaction: 'tap' as const,
                  authority: footerAuthorities.portfolioUpgrade,
                  content: <Upgrade />,
                },
              }
            : {}),
          support: {
            interaction: 'tap',
            authority: footerAuthorities.portfolioSupport,
            content: <SupportHub nativeSlot />,
          },
        },
        ...(perpsSection.value.kind === 'ready'
          ? {
              perps: {
                ...(shouldShowUpgrade
                  ? {
                      upgrade: {
                        interaction: 'tap' as const,
                        authority: footerAuthorities.perpsUpgrade,
                        content: <Upgrade />,
                      },
                    }
                  : {}),
                support: {
                  interaction: 'tap' as const,
                  authority: footerAuthorities.perpsSupport,
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
        defi: {
          ...(shouldShowUpgrade
            ? {
                upgrade: {
                  interaction: 'tap' as const,
                  authority: footerAuthorities.defiUpgrade,
                  content: <Upgrade />,
                },
              }
            : {}),
          support: {
            interaction: 'tap',
            authority: footerAuthorities.defiSupport,
            content: <SupportHub nativeSlot />,
          },
        },
      },
    }),
    [
      accountRowAuthority,
      actionRowAuthority,
      backupStateAuthority,
      balanceAuthority,
      displayedShowLpTokensOnly,
      deFiStateAuthority,
      footerAuthorities,
      header.actionRowHeight,
      historyAccessoryAuthority,
      intl,
      isBackupRequired,
      isOthersWallet,
      nativeTheme.backgroundColor,
      nativeLabels.tokens,
      network?.isAllNetworks,
      nftStateAuthority,
      perpsCanDeposit,
      perpsDepositDisabled,
      perpsHeaderAuthority,
      perpsPayload,
      perpsSection.value.kind,
      portfolioAccessoryAuthority,
      portfolioHeaderAuthority,
      portfolioPayload,
      reactBalancePresentation,
      shouldShowActionRowSkeleton,
      setShowLpTokensOnly,
      shouldShowUpgrade,
      tabTitles,
    ],
  );
  const slotBundle = useMemo(
    () =>
      owner
        ? {
            owner,
            semanticRevision: commitIdentity.storeCommitId,
            slotContractRevision: HOME_CONTAINER_SLOT_CONTRACT_REVISION,
            slots,
          }
        : undefined,
    [commitIdentity.storeCommitId, owner, slots],
  );

  const revisionState = useMemo(
    () => ({
      storeCommitId: commitIdentity.storeCommitId,
      presentationRevisions: {
        shell: shell.presentationRevision,
        navigation: homeNavigation.presentationRevision,
        sections: {
          portfolio: portfolioSection.presentationRevision,
          perps: perpsSection.presentationRevision,
          defi: defiSection.presentationRevision,
          nft: nftSection.presentationRevision,
          history: historySection.presentationRevision,
          market: marketSection.presentationRevision,
        },
      },
      authorityRevisions: {
        shellCommands: shell.shellCommandRevision,
        tabApplicability: homeNavigation.tabApplicabilityRevision,
        sectionCommands: {
          portfolio: portfolioSection.sectionCommandRevision,
          perps: perpsSection.sectionCommandRevision,
          defi: defiSection.sectionCommandRevision,
          nft: nftSection.sectionCommandRevision,
          history: historySection.sectionCommandRevision,
          market: marketSection.sectionCommandRevision,
        },
      },
      slotRevisions: collectSlotRevisions(slots),
    }),
    [
      commitIdentity.storeCommitId,
      defiSection,
      historySection,
      homeNavigation,
      marketSection,
      nftSection,
      perpsSection,
      portfolioSection,
      shell,
      slots,
    ],
  );
  const controller = useMemo(
    () =>
      owner
        ? new HomeContainerController({
            initialOwner: owner,
            initialProtocolV3Revisions: revisionState,
            initialSlots: slots,
            initialSnapshot: snapshot,
            requireProtocolV3: true,
          })
        : undefined,
    // A controller is a transport session and must only be replaced with owner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner?.scopeKey, owner?.sessionId],
  );
  const initialSnapshot = useMemo(
    () => controller?.getInitialProtocolV3Snapshot(),
    [controller],
  );
  const previousSnapshotRef = useRef(snapshot);
  const attachedTargetRef = useRef<IHomeContainerRef | undefined>(undefined);
  const refreshFeedbackTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  const disposeNativeSession = useCallback(() => {
    const target = attachedTargetRef.current ?? nativeRef.current ?? undefined;
    refreshFeedbackTimersRef.current.forEach((timeoutId, requestId) => {
      clearTimeout(timeoutId);
      target?.completeRefresh(requestId);
    });
    refreshFeedbackTimersRef.current.clear();
    controller?.detach(target);
    controller?.dispose();
    attachedTargetRef.current = undefined;
    nativeCapabilitiesRef.current = undefined;
  }, [controller]);

  useLayoutEffect(() => {
    if (!controller) {
      return;
    }
    const previous = previousSnapshotRef.current;
    controller.setProtocolV3RevisionState(revisionState);
    if (!equal(previous.header, snapshot.header)) {
      controller.updateHeader(snapshot.header);
    }
    if (!equal(previous.theme, snapshot.theme)) {
      controller.updateTheme(snapshot.theme);
    }
    if (
      !equal(navigationShell(previous.tabs), navigationShell(snapshot.tabs))
    ) {
      controller.updateTabs(snapshot.tabs);
    } else {
      snapshot.tabs.forEach((tab) => {
        const previousTab = previous.tabs.find((item) => item.id === tab.id);
        if (
          tab.destination === 'inline' &&
          previousTab?.destination === 'inline' &&
          !equal(previousTab.sections, tab.sections)
        ) {
          controller.updateTabSections(tab.id, tab.sections);
        }
      });
    }
    if (previous.selectedTabId !== snapshot.selectedTabId) {
      controller.selectTab(snapshot.selectedTabId);
    }
    controller.updateSlots(slots);
    previousSnapshotRef.current = snapshot;
  }, [controller, revisionState, slots, snapshot]);

  useLayoutEffect(() => () => disposeNativeSession(), [disposeNativeSession]);

  useLayoutEffect(() => {
    const target = nativeRef.current;
    if (!target || !controller) {
      return;
    }
    // The native view outlives an owner-scoped controller, so an owner switch
    // must attach the replacement without waiting for another native onReady.
    const capabilities =
      nativeCapabilitiesRef.current ?? target.getCapabilities();
    if (!capabilities) {
      return;
    }
    if (!controller.attach(target, capabilities)) {
      defaultLogger.app.error.log(
        '[NativeHome] controller attach failed after owner change',
      );
      return;
    }
    nativeCapabilitiesRef.current = capabilities;
    attachedTargetRef.current = target;
  }, [controller]);

  useEffect(() => {
    const value = homeNavigation.value;
    let networkScope: 'allNetworks' | 'singleNetwork' | 'unknown' = 'unknown';
    if (facts?.owner.network.kind === 'allNetworks') {
      networkScope = 'allNetworks';
    } else if (facts?.owner.network.kind === 'singleNetwork') {
      networkScope = 'singleNetwork';
    }
    let balanceState: 'zero' | 'positive' | 'unknown' = 'unknown';
    if (balancePresentation?.kind === 'zero') {
      balanceState = 'zero';
    } else if (funded) {
      balanceState = 'positive';
    }
    let walletActionFamily: 'zero' | 'funded' | 'loading' = 'loading';
    if (balancePresentation?.kind === 'zero') {
      walletActionFamily = 'zero';
    } else if (funded) {
      walletActionFamily = 'funded';
    }
    const bannerCount = bannerPayload?.banners.length ?? 0;
    const hasTronResource = Boolean(bannerPayload?.tronResource);
    const shouldShowBanner =
      bannerPresentation === 'content' && (bannerCount > 0 || hasTronResource);
    const decisionKey = stringUtils.stableStringify({
      accountRowAuthority,
      actionRowAuthority,
      backupStateAuthority,
      balanceModel,
      balancePresentation,
      bannerCount,
      hasTronResource,
      bannerPayloadParsed: Boolean(bannerPayload),
      bannerResourceKind: bannerResource.kind,
      funded,
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
      showAccountSlot: Boolean(accountRowAuthority),
      showActionSlot: Boolean(actionRowAuthority) && !isBackupRequired,
      showBackupSlot: Boolean(backupStateAuthority),
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
      showPositiveBanner: balancePresentation?.banner.kind === 'positive',
      shouldShowBanner,
      walletActionFamily,
      shouldShowWalletActions: Boolean(balanceModel) || funded,
      isWalletNotBackedUp: shell.value.kind === 'backupRequired',
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
    balancePresentation,
    accountRowAuthority,
    actionRowAuthority,
    backupStateAuthority,
    bannerPayload,
    bannerPresentation,
    bannerResource.kind,
    facts?.owner.network.kind,
    funded,
    header.balance,
    header.balanceSecondary,
    homeNavigation.value,
    isBackupRequired,
    portfolioResource,
    shell.value.kind,
  ]);

  const dispatchTabIntent = useCallback(
    (tabId: IHomeContainerTabId, revision: number) => {
      if (!facts) {
        return false;
      }
      return didAcceptIntent(
        dispatchHomeIntent({
          type: 'tabSelected',
          authority: { kind: 'tabApplicability', revision },
          intentId: createHomeAuthorityId('intent'),
          owner: facts.owner,
          sessionId: facts.ownerToken.sessionId,
          tabId,
        }),
      );
    },
    [dispatchHomeIntent, facts],
  );

  const dispatchNativeAction = useCallback(
    (intent: IHomeContainerIntentV3) => {
      if (!facts || intent.intent.kind !== 'action') {
        return;
      }
      const authority = intent.authority;
      let storeIntent: IHomeStoreIntent;
      if (authority.kind === 'shellCommands') {
        storeIntent = {
          type: 'headerActionInvoked',
          actionId: intent.intent.commandId,
          authority,
          execution: 'controller',
          intentId: intent.intentId,
          itemId: intent.intent.itemId,
          owner: facts.owner,
          sessionId: facts.ownerToken.sessionId,
        };
      } else if (authority.kind === 'sectionCommands') {
        let targetSectionId = authority.sectionId;
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
        let targetRevision = authority.revision;
        if (targetSectionId === 'defi') {
          targetRevision = defiSection.sectionCommandRevision;
        } else if (targetSectionId === 'market') {
          targetRevision = marketSection.sectionCommandRevision;
        }
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
          itemId: intent.intent.itemId,
          owner: facts.owner,
          sectionId: targetSectionId,
          sessionId: facts.ownerToken.sessionId,
        };
      } else {
        return;
      }
      dispatchHomeIntent(storeIntent);
    },
    [
      defiSection.sectionCommandRevision,
      dispatchHomeIntent,
      facts,
      marketSection.sectionCommandRevision,
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
    (tabId: IHomeContainerTabId, requestId: string, revision: number) => {
      if (!facts) {
        nativeRef.current?.completeRefresh(requestId);
        return;
      }
      let didStartRefresh = false;
      tabs.forEach((tab) => {
        const sectionId = tab.id;
        const effects = dispatchHomeIntent({
          type: 'sectionRefreshRequested',
          actionId: `home.${sectionId}.refresh`,
          authority: {
            kind: 'sectionCommands',
            revision:
              sectionId === tabId
                ? revision
                : revisionState.authorityRevisions.sectionCommands[sectionId],
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
    [dispatchHomeIntent, facts, revisionState, tabs],
  );

  const handleIntent = useCallback(
    (value: string) => {
      const parsed = parseHomeContainerIntentV3(value);
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
          handleOnManageToken();
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
        if (dispatchTabIntent(parsed.intent.tabId, parsed.authority.revision)) {
          controller?.recordSelectedTab(parsed.intent.tabId);
        } else {
          nativeRef.current?.selectTab(selectedTabId, false);
        }
        return;
      }
      if (
        parsed.intent.kind === 'refresh' &&
        parsed.authority.kind === 'sectionCommands' &&
        isTabId(parsed.intent.tabId)
      ) {
        handleRefreshIntent(
          parsed.intent.tabId,
          parsed.intent.requestId,
          parsed.authority.revision,
        );
        return;
      }
      if (parsed.intent.kind === 'handoff') {
        if (!facts || parsed.authority.kind !== 'tabApplicability') {
          return;
        }
        const effects = dispatchHomeIntent({
          type: 'tabHandoffInvoked',
          actionId: parsed.intent.commandId,
          authority: parsed.authority,
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
      controller,
      addRecommendedMarketTokens,
      bannerPayload?.tronResource,
      dispatchHomeIntent,
      dispatchNativeAction,
      dispatchTabIntent,
      facts,
      handleOnManageToken,
      handleRefreshIntent,
      navigation,
      marketPayload,
      openLowValueAssets,
      openRiskAssets,
      owner,
      selectMarketCategory,
      selectedTabId,
      selectedRecommendedMarketRowIds,
      toggleMarketFavorite,
      viewMoreMarket,
    ],
  );

  const handleReady = useCallback(
    (capabilities: IHomeContainerCapabilities) => {
      const target = nativeRef.current;
      nativeCapabilitiesRef.current = capabilities;
      if (!target || !controller) {
        return;
      }
      if (!controller.attach(target, capabilities)) {
        defaultLogger.app.error.log(
          '[NativeHome] controller attach failed during native readiness',
        );
        return;
      }
      attachedTargetRef.current = target;
    },
    [controller],
  );
  const handleTransportResult = useCallback(
    (value: string) => {
      const result = parseHomeContainerTransportResult(value);
      if (!result) {
        defaultLogger.wallet.homeUi.homeNativeTransportDecision({
          resultKind: 'invalid',
        });
      } else if (result.kind === 'needSnapshot') {
        defaultLogger.wallet.homeUi.homeNativeTransportDecision({
          resultKind: result.kind,
          currentRevision: result.currentRevision,
          reason: result.reason,
        });
      } else {
        defaultLogger.wallet.homeUi.homeNativeTransportDecision({
          resultKind: result.kind,
          revision: result.revision,
        });
      }
      controller?.handleTransportResult(value);
    },
    [controller],
  );

  const handleRenderError = useCallback((code: string, message: string) => {
    defaultLogger.app.error.log(
      `[NativeHome] render failed: code=${code}, message=${message}`,
    );
  }, []);

  if (!owner || !controller || !initialSnapshot) {
    return null;
  }

  return (
    <Stack flex={1} bg="$bgApp">
      <HomeTabSearchHeader />
      <HomeContainer
        ref={nativeRef}
        initialSnapshot={initialSnapshot}
        style={{ flex: 1 }}
        slotBundle={slotBundle}
        testID="NativeHomeContainer"
        onReady={handleReady}
        onIntent={handleIntent}
        onTransportResult={handleTransportResult}
        onRenderError={handleRenderError}
      />
    </Stack>
  );
}
