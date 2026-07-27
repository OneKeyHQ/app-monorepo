import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHomeDisplayModel } from '@onekeyhq/kit/src/hooks/useHomeBalanceState';
import { useManageToken } from '@onekeyhq/kit/src/hooks/useManageToken';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeContextStore,
  useHomeInteraction,
  useHomeNavigation,
  useHomeResource,
  useHomeSection,
  useHomeSessionState,
  useHomeShell,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { readHomeStoreState } from '@onekeyhq/kit/src/states/jotai/contexts/home/actions';
import { formatPortfolioTotal } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/formatPortfolioTotal';
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
import { getHomeRuntimeDispatcher } from '@onekeyhq/kit/src/views/Home/model/runtime/homeRuntimeRegistry';
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
import type { IHomeStoreIntent } from '@onekeyhq/kit/src/views/Home/model/store/homeStoreTypes';
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
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  HomeContainer,
  type IHomeContainerCapabilities,
  type IHomeContainerHeader,
  type IHomeContainerIntentV3,
  type IHomeContainerOwner,
  type IHomeContainerRef,
  type IHomeContainerSlots,
  type IHomeContainerTabId,
  type IHomeContainerTheme,
  parseHomeContainerIntentV3,
} from '@onekeyhq/native-components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalAssetListRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import {
  MobileNativeHomeBridgeRuntime,
  isNativeHomeTabId,
} from './MobileNativeHomeBridgeRuntime';
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
  resolveMobileNativeHomeActionRowHeight,
  resolveMobileNativeHomeBannerPresentation,
} from './mobileNativeHomeViewModelAdapter';

const HOME_REFRESH_FEEDBACK_DURATION_MS = 1200;
const MOBILE_NATIVE_HOME_TRON_RESOURCE_ACTION_ID =
  'home.native.banner.openTronResource';
const MOBILE_NATIVE_HOME_ACTION_SKELETON_COUNT = 4;
const MemoHomeTabSearchHeader = memo(HomeTabSearchHeader);

function useStableRevisionValue<T extends { revision: string }>(value: T): T {
  const valueRef = useRef(value);
  if (valueRef.current.revision !== value.revision) {
    valueRef.current = value;
  }
  return valueRef.current;
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
  if (hidden) return '••••';
  const value = Number(amount);
  if (!Number.isFinite(value)) return '';
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

function useNativeTheme(): IHomeContainerTheme {
  const theme = useTheme();
  return useMemo(
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
}

function useTabTitles() {
  const intl = useIntl();
  return useMemo(
    () => ({
      portfolio: intl.formatMessage({ id: ETranslations.dexmarket_spot }),
      perps: intl.formatMessage({ id: ETranslations.global_perp }),
      defi: intl.formatMessage({ id: ETranslations.global_earn }),
      nft: intl.formatMessage({ id: ETranslations.global_nft }),
      history: intl.formatMessage({ id: ETranslations.global_history }),
    }),
    [intl],
  );
}

function useNativeLabels() {
  const intl = useIntl();
  return useMemo(
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
}

function useUpgradeAvailable() {
  const { isPrimeAvailable } = usePrimeAvailable();
  const { user } = useOneKeyAuth();
  return Boolean(
    isPrimeAvailable &&
    !(user?.primeSubscription?.isActive && user.onekeyUserId),
  );
}

const MobileNativeHomeNavigationBridge = memo(
  function MobileNativeHomeNavigationBridge({
    runtime,
  }: {
    runtime: MobileNativeHomeBridgeRuntime;
  }) {
    const navigation = useHomeNavigation();
    const displayModel = useHomeDisplayModel();
    const tabTitles = useTabTitles();
    useLayoutEffect(() => {
      const value = navigation.value;
      let visibleTabs: readonly IHomeContainerTabId[] = ['portfolio'];
      if (
        displayModel.navigation.kind !== 'portfolioOnly' &&
        value.kind === 'ready'
      ) {
        visibleTabs = value.tabs;
      }
      const destinations: Partial<
        Record<IHomeContainerTabId, 'inline' | 'handoff'>
      > = {};
      if (value.kind === 'ready') {
        value.tabs.forEach((tabId) => {
          destinations[tabId] =
            value.destinations?.[tabId] === 'web' ? 'handoff' : 'inline';
        });
      }
      const requested =
        value.kind === 'ready' ? value.selectedTabId : 'portfolio';
      const selectedTabId =
        visibleTabs.includes(requested) && destinations[requested] !== 'handoff'
          ? requested
          : (visibleTabs.find((tabId) => destinations[tabId] !== 'handoff') ??
            'portfolio');
      runtime.updateNavigation({
        bodyPresentationKind: displayModel.body.kind,
        destinations,
        selectedTabId,
        tabApplicabilityRevision: navigation.tabApplicabilityRevision,
        tabTitles,
        visibleTabs,
      });
    }, [
      displayModel.body.kind,
      displayModel.navigation.kind,
      navigation,
      runtime,
      tabTitles,
    ]);
    return null;
  },
);

const MobileNativeHomeHeaderBridge = memo(
  function MobileNativeHomeHeaderBridge({
    runtime,
  }: {
    runtime: MobileNativeHomeBridgeRuntime;
  }) {
    const intl = useIntl();
    const shell = useHomeShell();
    const bannerResource = useHomeResource('banner');
    const displayModel = useHomeDisplayModel();
    const balancePresentation = useStableRevisionValue(displayModel.balance);
    const [{ hideValue }] = useSettingsValuePersistAtom();
    const {
      activeAccount: { isOthersWallet, network },
    } = useActiveAccount({ num: 0 });
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
    const balanceModel =
      balancePresentation.kind === 'ready'
        ? balancePresentation.balance
        : undefined;
    const isBackupRequired = displayModel.body.kind === 'backupPrompt';
    const bannerPresentation = resolveMobileNativeHomeBannerPresentation({
      bannerPolicyKind: displayModel.banner.kind,
      bannerResourceKind: bannerResource.kind,
      hasBannerContent: Boolean(
        bannerPayload &&
        (bannerPayload.banners.length > 0 || bannerPayload.tronResource),
      ),
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
        actionPresentationKind: displayModel.actions.kind,
      });
      const actionRowHeight = resolveMobileNativeHomeActionRowHeight({
        actionLayout,
        isBackupRequired,
      });
      let banners: IHomeContainerHeader['banners'] = [];
      if (bannerPresentation === 'loading') {
        banners = [{ id: MOBILE_NATIVE_HOME_BANNER_SKELETON_ID, title: '' }];
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
                      value: `${tronAccountResource.result?.energyAvailable?.toFixed() ?? '0'} / ${tronAccountResource.result?.energyTotal?.toFixed() ?? '0'}`,
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
                      value: `${tronAccountResource.result?.netAvailable?.toFixed() ?? '0'} / ${tronAccountResource.result?.netTotal?.toFixed() ?? '0'}`,
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
        balanceActionId: balanceModel
          ? HOME_SHELL_ACTION_IDS.balance
          : undefined,
        actionRowHeight,
        actionLayout,
        actions: [],
        banners,
      };
    }, [
      balanceModel,
      bannerPayload,
      bannerPresentation,
      displayModel.actions.kind,
      hideValue,
      intl,
      isBackupRequired,
      tronAccountResource.result,
    ]);
    const accountSlots = useMemo<IHomeContainerSlots>(
      () => ({
        accountRow: {
          interaction: 'tap',
          authority: runtime.authority('header.account-row', 1),
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
      }),
      [isOthersWallet, network?.isAllNetworks, runtime],
    );
    const balanceSlots = useMemo<IHomeContainerSlots>(
      () => ({
        balance: {
          interaction: 'tap',
          authority: runtime.authority(
            'header.balance',
            shell.balancePresentationRevision,
          ),
          content: (
            <HomeOverviewContainer
              nativeSlot
              balancePresentation={balancePresentation}
              manualRefreshEnabled={!isBackupRequired}
            />
          ),
        },
      }),
      [
        balancePresentation,
        isBackupRequired,
        runtime,
        shell.balancePresentationRevision,
      ],
    );
    const actionSlots = useMemo<IHomeContainerSlots>(
      () => ({
        headerActionRow:
          displayModel.actions.kind === 'hidden'
            ? undefined
            : {
                interaction: 'tap',
                authority: runtime.authority(
                  'header.action-row',
                  shell.actionsPresentationRevision,
                ),
                height: header.actionRowHeight,
                content:
                  header.actionLayout === 'loading' ? (
                    <MobileNativeHomeActionRowSkeleton />
                  ) : (
                    (displayModel.actions.kind === 'funded' ||
                      displayModel.actions.kind === 'zero') && (
                      <WalletActions actionFamily={displayModel.actions.kind} />
                    )
                  ),
              },
      }),
      [
        displayModel.actions.kind,
        header.actionLayout,
        header.actionRowHeight,
        runtime,
        shell.actionsPresentationRevision,
      ],
    );
    const bodySlots = useMemo<IHomeContainerSlots>(
      () => ({
        contentStates: isBackupRequired
          ? {
              portfolio: {
                interaction: 'tap',
                authority: runtime.authority(
                  'content.state.portfolio',
                  shell.bodyPresentationRevision,
                ),
                content: <NotBackedUpEmpty />,
                height: 320,
              },
            }
          : {},
      }),
      [isBackupRequired, runtime, shell.bodyPresentationRevision],
    );
    useLayoutEffect(() => {
      runtime.updateHeader({
        commandRevision: shell.shellCommandRevision,
        header,
      });
    }, [
      header,
      runtime,
      shell.presentationRevision,
      shell.shellCommandRevision,
    ]);
    useLayoutEffect(() => {
      runtime.updateSlots('header-account', accountSlots);
    }, [accountSlots, runtime]);
    useLayoutEffect(() => {
      runtime.updateSlots('header-balance', balanceSlots);
    }, [balanceSlots, runtime]);
    useLayoutEffect(() => {
      runtime.updateSlots('header-actions', actionSlots);
    }, [actionSlots, runtime]);
    useLayoutEffect(() => {
      runtime.updateSlots('header-body', bodySlots);
    }, [bodySlots, runtime]);
    useLayoutEffect(
      () =>
        runtime.registerIntentHandler('tron-resource', (intent) => {
          if (
            intent.intent.kind !== 'action' ||
            intent.intent.commandId !==
              MOBILE_NATIVE_HOME_TRON_RESOURCE_ACTION_ID
          ) {
            return false;
          }
          if (tronResource) {
            showResourceDetailsDialog({
              accountId: tronResource.accountId,
              networkId: tronResource.networkId,
            });
          }
          return true;
        }),
      [runtime, tronResource],
    );
    return null;
  },
);

const MobileNativeHomePortfolioBridge = memo(
  function MobileNativeHomePortfolioBridge({
    runtime,
  }: {
    runtime: MobileNativeHomeBridgeRuntime;
  }) {
    const intl = useIntl();
    const navigation = useAppNavigation();
    const labels = useNativeLabels();
    const tabTitles = useTabTitles();
    const section = useHomeSection('portfolio');
    const interaction = useHomeInteraction();
    const displayModel = useHomeDisplayModel();
    const portfolioPayload = useHomeSectionPayload('portfolio');
    const defiPayload = useHomeSectionPayload('defi');
    const marketPayload = useHomeSectionPayload('market');
    const [{ hideValue }] = useSettingsValuePersistAtom();
    const shouldShowUpgrade = useUpgradeAvailable();
    const { setShowLpTokensOnly } = useHomePortfolioIntents();
    const { addRecommended, selectCategory, toggleFavorite, viewMore } =
      useHomeMarketIntents();
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
    const [expanded, setExpanded] = useState<IHomeNativeExpandedState>({
      defi: false,
      portfolioAssets: false,
      portfolioDeFi: false,
    });
    const [selectedRecommendedIds, setSelectedRecommendedIds] = useState<
      string[]
    >([]);
    useEffect(() => {
      setExpanded({
        defi: false,
        portfolioAssets: false,
        portfolioDeFi: false,
      });
    }, [portfolioPayload?.ownerKey, portfolioPayload?.showLpTokensOnly]);
    useEffect(() => {
      setSelectedRecommendedIds(
        marketPayload?.favoriteMode === 'recommendation'
          ? marketPayload.rows
              .slice(0, 4)
              .map((row) => getHomeMarketTokenRowId(row))
          : [],
      );
    }, [marketPayload]);
    const recommendationState = useMemo<
      IHomeNativeMarketRecommendationState | undefined
    >(
      () =>
        marketPayload?.favoriteMode === 'recommendation'
          ? {
              actionTitle: intl.formatMessage(
                { id: ETranslations.market_add_number_tokens },
                { number: selectedRecommendedIds.length },
              ),
              selectedRowIds: selectedRecommendedIds,
            }
          : undefined,
      [intl, marketPayload?.favoriteMode, selectedRecommendedIds],
    );
    const sections = useMemo(
      () =>
        buildMobileNativeHomeViewModelSections({
          allNetworksBadgeImageUrl: network?.logoURI,
          expanded,
          formatActionLabel: (labelId) => intl.formatMessage({ id: labelId }),
          isAllNetworks: Boolean(network?.isAllNetworks),
          labels,
          locale: intl.locale,
          marketRecommendationState: recommendationState,
          payloads: {
            portfolio: portfolioPayload,
            defi: defiPayload,
            market: marketPayload,
          },
          sectionId: 'portfolio',
          semantic: section.value,
        }),
      [
        defiPayload,
        expanded,
        intl,
        labels,
        marketPayload,
        network?.isAllNetworks,
        network?.logoURI,
        portfolioPayload,
        recommendationState,
        section.value,
      ],
    );
    useLayoutEffect(() => {
      runtime.updateSection({
        commandRevision: section.sectionCommandRevision,
        sectionId: 'portfolio',
        sections,
      });
    }, [
      runtime,
      section.presentationRevision,
      section.sectionCommandRevision,
      sections,
    ]);
    const requestedLp =
      interaction.sectionControls.portfolio?.[
        HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID
      ];
    const displayedLp =
      typeof requestedLp === 'boolean'
        ? requestedLp
        : (portfolioPayload?.showLpTokensOnly ?? false);
    const showLpTokenFilterSwitch = Boolean(
      portfolioPayload?.showLpTokenFilterSwitch,
    );
    const isLpTokenSwitchLoading = Boolean(
      portfolioPayload?.isLpTokenSwitchLoading,
    );
    const headerSlots = useMemo<IHomeContainerSlots>(
      () => ({
        contentHeaders:
          displayModel.body.kind === 'portfolio'
            ? {
                portfolio: {
                  interaction: showLpTokenFilterSwitch ? 'tap' : 'none',
                  authority: runtime.storeAuthority('content.header.portfolio'),
                  content: (
                    <RichBlockHeader
                      title={labels.tokens}
                      headerActions={
                        showLpTokenFilterSwitch ? (
                          <TokenSelectorLpTokenSwitch
                            value={displayedLp}
                            loading={isLpTokenSwitchLoading}
                            onChange={setShowLpTokensOnly}
                          />
                        ) : null
                      }
                      headerContainerProps={{ flex: 1, px: '$pagePadding' }}
                    />
                  ),
                },
              }
            : {},
      }),
      [
        displayedLp,
        displayModel.body.kind,
        isLpTokenSwitchLoading,
        labels.tokens,
        runtime,
        setShowLpTokensOnly,
        showLpTokenFilterSwitch,
      ],
    );
    const accessorySlots = useMemo<IHomeContainerSlots>(
      () => ({
        tabAccessories:
          displayModel.body.kind === 'portfolio'
            ? {
                portfolio: {
                  interaction: 'tap',
                  authority: runtime.authority('tab.accessory.portfolio', 1),
                  content: (
                    <TabHeaderSettings
                      nativeSlot
                      focusedTab={tabTitles.portfolio}
                    />
                  ),
                },
              }
            : {},
      }),
      [displayModel.body.kind, runtime, tabTitles.portfolio],
    );
    const footerSlots = useMemo<IHomeContainerSlots>(
      () => ({
        contentFooters:
          displayModel.body.kind === 'portfolio'
            ? {
                portfolio: {
                  ...(shouldShowUpgrade
                    ? {
                        upgrade: {
                          interaction: 'tap' as const,
                          authority: runtime.authority(
                            'content.footer.portfolio.upgrade',
                            1,
                          ),
                          content: <Upgrade />,
                        },
                      }
                    : {}),
                  support: {
                    interaction: 'tap',
                    authority: runtime.authority(
                      'content.footer.portfolio.support',
                      1,
                    ),
                    content: <SupportHub nativeSlot />,
                  },
                },
              }
            : {},
      }),
      [displayModel.body.kind, runtime, shouldShowUpgrade],
    );
    useLayoutEffect(() => {
      runtime.updateSlots('portfolio-header', headerSlots);
    }, [headerSlots, runtime]);
    useLayoutEffect(() => {
      runtime.updateSlots('portfolio-accessory', accessorySlots);
    }, [accessorySlots, runtime]);
    useLayoutEffect(() => {
      runtime.updateSlots('portfolio-footer', footerSlots);
    }, [footerSlots, runtime]);

    const openLowValueAssets = useCallback(() => {
      if (!account || !network || !wallet || !portfolioPayload) return;
      const tokens = portfolioPayload.smallBalanceTokens ?? [];
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetListRoutes.TokenList,
        params: {
          title: intl.formatMessage({ id: ETranslations.low_value_assets }),
          helpText: [
            intl.formatMessage({
              id: ETranslations.low_value_assets_desc_out_of_range,
            }),
            intl.formatMessage({ id: ETranslations.low_value_assets_desc }),
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
      if (!account || !network || !wallet || !portfolioPayload) return;
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
    useLayoutEffect(
      () =>
        runtime.registerIntentHandler('portfolio-actions', (intent) => {
          if (intent.intent.kind !== 'action') return false;
          const { commandId, itemId } = intent.intent;
          if (
            commandId ===
            MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.openLowValueAssets
          ) {
            openLowValueAssets();
            return true;
          }
          if (
            commandId ===
            MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.openRiskAssets
          ) {
            openRiskAssets();
            return true;
          }
          if (
            commandId ===
            MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.openManageToken
          ) {
            handleOnManageToken();
            return true;
          }
          if (
            commandId ===
            MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.togglePortfolioAssetsExpanded
          ) {
            setExpanded((current) => ({
              ...current,
              portfolioAssets: !current.portfolioAssets,
            }));
            return true;
          }
          if (
            commandId ===
            MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.togglePortfolioDeFiExpanded
          ) {
            setExpanded((current) => ({
              ...current,
              portfolioDeFi: !current.portfolioDeFi,
            }));
            return true;
          }
          if (
            commandId.startsWith(
              MOBILE_NATIVE_HOME_MARKET_CATEGORY_ACTION_PREFIX,
            )
          ) {
            selectCategory(
              commandId.slice(
                MOBILE_NATIVE_HOME_MARKET_CATEGORY_ACTION_PREFIX.length,
              ),
            );
            return true;
          }
          if (
            commandId === MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.toggleRecommended
          ) {
            if (itemId) {
              setSelectedRecommendedIds((current) =>
                current.includes(itemId)
                  ? current.filter((rowId) => rowId !== itemId)
                  : [...current, itemId],
              );
            }
            return true;
          }
          if (
            commandId === MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.addRecommended
          ) {
            const selected = new Set(selectedRecommendedIds);
            const records = (marketPayload?.rows ?? [])
              .slice(0, 4)
              .filter((record) =>
                selected.has(getHomeMarketTokenRowId(record)),
              );
            if (records.length) void addRecommended(records);
            return true;
          }
          if (
            commandId === MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.toggleFavorite
          ) {
            const record = [
              ...(marketPayload?.rows ?? []),
              ...(marketPayload?.perpsHotRows ?? []),
            ].find(
              (candidate) => getHomeMarketTokenRowId(candidate) === itemId,
            );
            if (record && marketPayload) {
              const checked = marketPayload.watchListItems.some((item) =>
                record.perpsCoin
                  ? item.perpsCoin === record.perpsCoin
                  : item.chainId === record.chainId &&
                    item.contractAddress.toLowerCase() ===
                      record.contractAddress.toLowerCase(),
              );
              void toggleFavorite({
                checked,
                record,
                watchListItems: marketPayload.watchListItems,
              });
            }
            return true;
          }
          if (commandId === MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.viewMore) {
            const category = marketPayload?.resolvedCategoryId;
            viewMore(category === 'favorites' ? undefined : category);
            return true;
          }
          if (
            commandId === MOBILE_NATIVE_HOME_MARKET_ACTION_IDS.viewMorePerps
          ) {
            viewMore(HOME_PERPS_HOT_CATEGORY_ID);
            return true;
          }
          return false;
        }),
      [
        addRecommended,
        handleOnManageToken,
        marketPayload,
        openLowValueAssets,
        openRiskAssets,
        runtime,
        selectCategory,
        selectedRecommendedIds,
        toggleFavorite,
        viewMore,
      ],
    );
    return null;
  },
);

const MobileNativeHomePerpsBridge = memo(function MobileNativeHomePerpsBridge({
  runtime,
}: {
  runtime: MobileNativeHomeBridgeRuntime;
}) {
  const intl = useIntl();
  const labels = useNativeLabels();
  const section = useHomeSection('perps');
  const payload = useHomeSectionPayload('perps');
  const marketPayload = useHomeSectionPayload('market');
  const shouldShowUpgrade = useUpgradeAvailable();
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const sections = useMemo(
    () =>
      buildMobileNativeHomeViewModelSections({
        expanded: {
          defi: false,
          portfolioAssets: false,
          portfolioDeFi: false,
        },
        labels,
        locale: intl.locale,
        payloads: { perps: payload, market: marketPayload },
        sectionId: 'perps',
        semantic: section.value,
      }),
    [intl.locale, labels, marketPayload, payload, section.value],
  );
  useLayoutEffect(() => {
    runtime.updateSection({
      commandRevision: section.sectionCommandRevision,
      sectionId: 'perps',
      sections,
    });
  }, [
    runtime,
    section.presentationRevision,
    section.sectionCommandRevision,
    sections,
  ]);
  const isEmpty = section.value.kind === 'empty';
  const canDeposit = Boolean(payload?.address);
  const depositDisabled = accountUtils.isWatchingAccount({
    accountId: account?.id ?? '',
  });
  const slots = useMemo<IHomeContainerSlots>(
    () => ({
      contentHeaders:
        payload && section.value.kind === 'ready'
          ? {
              perps: {
                interaction: 'tap',
                authority: runtime.authority(
                  'content.header.perps',
                  section.presentationRevision,
                ),
                content: (
                  <PerpsHomeHeaderSlot
                    totalUsd={payload.view.accountValueUsd}
                    isDegraded={payload.view.isDegraded}
                    canDeposit={canDeposit}
                    isDepositDisabled={depositDisabled}
                  />
                ),
              },
            }
          : {},
      contentStates: isEmpty
        ? {
            perps: {
              interaction: 'tap',
              authority: runtime.authority(
                'content.state.perps',
                section.presentationRevision,
              ),
              content: (
                <PerpsHomeStateSlot
                  viewState="empty"
                  canDeposit={canDeposit}
                  isDepositDisabled={depositDisabled}
                />
              ),
              height: 600,
            },
          }
        : {},
      contentFooters:
        section.value.kind === 'ready' || isEmpty
          ? {
              perps: {
                ...(shouldShowUpgrade
                  ? {
                      upgrade: {
                        interaction: 'tap' as const,
                        authority: runtime.authority(
                          'content.footer.perps.upgrade',
                          1,
                        ),
                        content: <Upgrade />,
                      },
                    }
                  : {}),
                support: {
                  interaction: 'tap',
                  authority: runtime.authority(
                    'content.footer.perps.support',
                    1,
                  ),
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
          : {},
    }),
    [
      canDeposit,
      depositDisabled,
      intl,
      isEmpty,
      payload,
      runtime,
      section.presentationRevision,
      section.value.kind,
      shouldShowUpgrade,
    ],
  );
  useLayoutEffect(() => {
    runtime.updateSlots('perps', slots);
  }, [runtime, slots]);
  return null;
});

const MobileNativeHomeDeFiBridge = memo(function MobileNativeHomeDeFiBridge({
  runtime,
}: {
  runtime: MobileNativeHomeBridgeRuntime;
}) {
  const intl = useIntl();
  const labels = useNativeLabels();
  const tabTitles = useTabTitles();
  const section = useHomeSection('defi');
  const payload = useHomeSectionPayload('defi');
  const [settings] = useSettingsPersistAtom();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const shouldShowUpgrade = useUpgradeAvailable();
  const [expanded, setExpanded] = useState(false);
  const sections = useMemo(
    () =>
      buildMobileNativeHomeViewModelSections({
        expanded: {
          defi: expanded,
          portfolioAssets: false,
          portfolioDeFi: false,
        },
        formatActionLabel: (labelId) => intl.formatMessage({ id: labelId }),
        labels,
        locale: intl.locale,
        payloads: { defi: payload },
        sectionTitle: payload
          ? `${tabTitles.defi} · ${formatPortfolioTotal(
              getDeFiTotal(payload),
              settings.currencyInfo.symbol,
              hideValue,
            )}`
          : undefined,
        sectionId: 'defi',
        semantic: section.value,
      }),
    [
      expanded,
      hideValue,
      intl,
      labels,
      payload,
      section.value,
      settings.currencyInfo.symbol,
      tabTitles.defi,
    ],
  );
  useLayoutEffect(() => {
    runtime.updateSection({
      commandRevision: section.sectionCommandRevision,
      sectionId: 'defi',
      sections,
    });
  }, [
    runtime,
    section.presentationRevision,
    section.sectionCommandRevision,
    sections,
  ]);
  const showEmpty =
    section.value.kind === 'empty' || section.value.kind === 'error';
  const slots = useMemo<IHomeContainerSlots>(
    () => ({
      contentStates: showEmpty
        ? {
            defi: {
              interaction: 'tap',
              authority: runtime.authority(
                'content.state.defi',
                section.presentationRevision,
              ),
              content: <EmptyDeFi tableLayout />,
              height: 360,
            },
          }
        : {},
      contentFooters: {
        defi: {
          ...(shouldShowUpgrade
            ? {
                upgrade: {
                  interaction: 'tap' as const,
                  authority: runtime.authority(
                    'content.footer.defi.upgrade',
                    1,
                  ),
                  content: <Upgrade />,
                },
              }
            : {}),
          support: {
            interaction: 'tap',
            authority: runtime.authority('content.footer.defi.support', 1),
            content: <SupportHub nativeSlot />,
          },
        },
      },
    }),
    [runtime, section.presentationRevision, shouldShowUpgrade, showEmpty],
  );
  useLayoutEffect(() => {
    runtime.updateSlots('defi', slots);
  }, [runtime, slots]);
  useLayoutEffect(
    () =>
      runtime.registerIntentHandler('defi-expand', (intent) => {
        if (
          intent.intent.kind === 'action' &&
          intent.intent.commandId ===
            MOBILE_NATIVE_HOME_PRESENTATION_ACTION_IDS.toggleDeFiExpanded
        ) {
          setExpanded((value) => !value);
          return true;
        }
        return false;
      }),
    [runtime],
  );
  return null;
});

const MobileNativeHomeNFTBridge = memo(function MobileNativeHomeNFTBridge({
  runtime,
}: {
  runtime: MobileNativeHomeBridgeRuntime;
}) {
  const intl = useIntl();
  const labels = useNativeLabels();
  const section = useHomeSection('nft');
  const payload = useHomeSectionPayload('nft');
  const portfolioPayload = useHomeSectionPayload('portfolio');
  const sections = useMemo(
    () =>
      buildMobileNativeHomeViewModelSections({
        labels,
        locale: intl.locale,
        payloads: { nft: payload, portfolio: portfolioPayload },
        sectionId: 'nft',
        semantic: section.value,
      }),
    [intl.locale, labels, payload, portfolioPayload, section.value],
  );
  useLayoutEffect(() => {
    runtime.updateSection({
      commandRevision: section.sectionCommandRevision,
      sectionId: 'nft',
      sections,
    });
  }, [
    runtime,
    section.presentationRevision,
    section.sectionCommandRevision,
    sections,
  ]);
  const showEmpty =
    section.value.kind === 'empty' || section.value.kind === 'error';
  const slots = useMemo<IHomeContainerSlots>(
    () => ({
      contentStates: showEmpty
        ? {
            nft: {
              interaction: 'none',
              authority: runtime.authority(
                'content.state.nft',
                section.presentationRevision,
              ),
              content: <EmptyNFT />,
              height: 360,
            },
          }
        : {},
    }),
    [runtime, section.presentationRevision, showEmpty],
  );
  useLayoutEffect(() => {
    runtime.updateSlots('nft', slots);
  }, [runtime, slots]);
  return null;
});

const MobileNativeHomeHistoryBridge = memo(
  function MobileNativeHomeHistoryBridge({
    runtime,
  }: {
    runtime: MobileNativeHomeBridgeRuntime;
  }) {
    const intl = useIntl();
    const labels = useNativeLabels();
    const tabTitles = useTabTitles();
    const section = useHomeSection('history');
    const payload = useHomeSectionPayload('history');
    const {
      activeAccount: { account, indexedAccount, network, wallet },
    } = useActiveAccount({ num: 0 });
    const sections = useMemo(
      () =>
        buildMobileNativeHomeViewModelSections({
          isAllNetworks: Boolean(network?.isAllNetworks),
          labels,
          locale: intl.locale,
          payloads: { history: payload },
          sectionId: 'history',
          semantic: section.value,
        }),
      [intl.locale, labels, network?.isAllNetworks, payload, section.value],
    );
    useLayoutEffect(() => {
      runtime.updateSection({
        commandRevision: section.sectionCommandRevision,
        sectionId: 'history',
        sections,
      });
    }, [
      runtime,
      section.presentationRevision,
      section.sectionCommandRevision,
      sections,
    ]);
    const isEmpty =
      section.value.kind === 'empty' ||
      (section.value.kind === 'ready' && (payload?.data.length ?? 0) === 0);
    const slots = useMemo<IHomeContainerSlots>(
      () => ({
        contentStates: isEmpty
          ? {
              history: {
                interaction: 'tap',
                authority: runtime.authority(
                  'content.state.history',
                  section.presentationRevision,
                ),
                content: (
                  <EmptyHistory
                    showViewInExplorer
                    walletId={wallet?.id}
                    accountId={account?.id}
                    networkId={network?.id}
                    indexedAccountId={indexedAccount?.id}
                    tokenMap={payload?.tokenMap ?? {}}
                  />
                ),
                height: 360,
              },
            }
          : {},
        tabAccessories: {
          history: {
            interaction: 'tap',
            authority: runtime.authority('tab.accessory.history', 1),
            content: (
              <TabHeaderSettings
                nativeSlot
                focusedTab={tabTitles.history}
                historyIcon="Filter1Outline"
              />
            ),
          },
        },
      }),
      [
        account?.id,
        indexedAccount?.id,
        isEmpty,
        network?.id,
        payload?.tokenMap,
        runtime,
        section.presentationRevision,
        tabTitles.history,
        wallet?.id,
      ],
    );
    useLayoutEffect(() => {
      runtime.updateSlots('history', slots);
    }, [runtime, slots]);
    return null;
  },
);

const MobileNativeHomeOwnerBridge = memo(function MobileNativeHomeOwnerBridge({
  nativeTheme,
  owner,
  runtime,
}: {
  nativeTheme: IHomeContainerTheme;
  owner: IHomeContainerOwner;
  runtime: MobileNativeHomeBridgeRuntime;
}) {
  useLayoutEffect(() => {
    runtime.replaceOwner(owner, nativeTheme);
  }, [nativeTheme, owner, runtime]);
  return null;
});

const MobileNativeHomeProducerBridges = memo(
  function MobileNativeHomeProducerBridges({
    runtime,
  }: {
    runtime: MobileNativeHomeBridgeRuntime;
  }) {
    return (
      <>
        <MobileNativeHomeNavigationBridge runtime={runtime} />
        <MobileNativeHomeHeaderBridge runtime={runtime} />
        <MobileNativeHomePortfolioBridge runtime={runtime} />
        <MobileNativeHomePerpsBridge runtime={runtime} />
        <MobileNativeHomeDeFiBridge runtime={runtime} />
        <MobileNativeHomeNFTBridge runtime={runtime} />
        <MobileNativeHomeHistoryBridge runtime={runtime} />
      </>
    );
  },
);

const MobileNativeHomeBridges = memo(function MobileNativeHomeBridges({
  nativeTheme,
  owner,
  runtime,
}: {
  nativeTheme: IHomeContainerTheme;
  owner: IHomeContainerOwner;
  runtime: MobileNativeHomeBridgeRuntime;
}) {
  const producerKey = `${owner.scopeKey}:${owner.sessionId}`;
  return (
    <>
      <MobileNativeHomeOwnerBridge
        nativeTheme={nativeTheme}
        owner={owner}
        runtime={runtime}
      />
      <MobileNativeHomeProducerBridges key={producerKey} runtime={runtime} />
    </>
  );
});

export function MobileNativeHomeRenderer(_props: INativeHomePageViewProps) {
  const navigation = useAppNavigation();
  const store = useHomeContextStore();
  const session = useHomeSessionState();
  const nativeTheme = useNativeTheme();
  const nativeRef = useRef<IHomeContainerRef>(null);
  const nativeCapabilitiesRef = useRef<IHomeContainerCapabilities | undefined>(
    undefined,
  );
  const attachedTargetRef = useRef<IHomeContainerRef | undefined>(undefined);
  const refreshTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const owner = useMemo<IHomeContainerOwner | undefined>(
    () =>
      session.ownerToken
        ? {
            scopeKey: session.ownerToken.scopeKey,
            sessionId: session.ownerToken.sessionId,
          }
        : undefined,
    [session.ownerToken],
  );
  const runtimeRef = useRef<MobileNativeHomeBridgeRuntime | undefined>(
    undefined,
  );
  if (!runtimeRef.current && owner) {
    runtimeRef.current = new MobileNativeHomeBridgeRuntime(
      owner,
      () => readHomeStoreState(store.get).commitIdentity.storeCommitId,
      nativeTheme,
    );
  }
  const runtime = runtimeRef.current;
  const slotBundle = useSyncExternalStore(
    runtime?.subscribeSlots ?? (() => () => undefined),
    runtime?.getSlotBundle ?? (() => undefined),
    runtime?.getSlotBundle ?? (() => undefined),
  );
  const initialSnapshot = useMemo(
    () => runtime?.getInitialSnapshot(),
    [runtime],
  );

  useLayoutEffect(() => {
    runtime?.updateTheme(nativeTheme);
  }, [nativeTheme, runtime]);

  useLayoutEffect(
    () => () => {
      const target =
        attachedTargetRef.current ?? nativeRef.current ?? undefined;
      refreshTimersRef.current.forEach((timer, requestId) => {
        clearTimeout(timer);
        target?.completeRefresh(requestId);
      });
      refreshTimersRef.current.clear();
      runtime?.controller.detach(target);
      runtime?.dispose();
      if (runtimeRef.current === runtime) {
        runtimeRef.current = undefined;
      }
      attachedTargetRef.current = undefined;
      nativeCapabilitiesRef.current = undefined;
    },
    [runtime],
  );

  const dispatchIntent = useCallback(
    (intent: IHomeStoreIntent) =>
      getHomeRuntimeDispatcher(store)?.dispatch({
        type: 'intentReceived',
        intent,
      }),
    [store],
  );

  const handleRefresh = useCallback(
    (
      tabId: IHomeContainerTabId,
      requestId: string,
      selectedRevision: number,
    ) => {
      const state = readHomeStoreState(store.get);
      const facts = state.facts;
      const navigationValue = state.navigation.value;
      if (!facts || navigationValue.kind !== 'ready') {
        nativeRef.current?.completeRefresh(requestId);
        return;
      }
      let accepted = false;
      navigationValue.tabs.forEach((sectionId) => {
        const receipt = dispatchIntent({
          type: 'sectionRefreshRequested',
          actionId: `home.${sectionId}.refresh`,
          authority: {
            kind: 'sectionCommands',
            revision:
              sectionId === tabId
                ? selectedRevision
                : state.sections[sectionId].sectionCommandRevision,
            sectionId,
          },
          intentId: createHomeAuthorityId('intent'),
          owner: facts.owner,
          sectionId,
          sessionId: facts.ownerToken.sessionId,
        });
        accepted = Boolean(receipt?.accepted) || accepted;
      });
      if (!accepted) {
        nativeRef.current?.completeRefresh(requestId);
        return;
      }
      const timer = setTimeout(() => {
        nativeRef.current?.completeRefresh(requestId);
        refreshTimersRef.current.delete(requestId);
      }, HOME_REFRESH_FEEDBACK_DURATION_MS);
      refreshTimersRef.current.set(requestId, timer);
    },
    [dispatchIntent, store],
  );

  const dispatchGenericAction = useCallback(
    (intent: IHomeContainerIntentV3) => {
      if (intent.intent.kind !== 'action') return;
      const state = readHomeStoreState(store.get);
      const facts = state.facts;
      if (!facts) return;
      const authority = intent.authority;
      if (authority.kind === 'shellCommands') {
        dispatchIntent({
          type: 'headerActionInvoked',
          actionId: intent.intent.commandId,
          authority,
          intentId: intent.intentId,
          itemId: intent.intent.itemId,
          owner: facts.owner,
          sessionId: facts.ownerToken.sessionId,
        });
        return;
      }
      if (authority.kind !== 'sectionCommands') return;
      let sectionId = authority.sectionId;
      if (
        intent.intent.commandId === HOME_SECTION_ACTION_IDS.openDeFiProtocol
      ) {
        sectionId = 'defi';
      } else if (
        intent.intent.commandId === HOME_SECTION_ACTION_IDS.openMarket ||
        intent.intent.commandId === HOME_SECTION_ACTION_IDS.openEarn
      ) {
        sectionId = 'market';
      }
      dispatchIntent({
        type: 'sectionActionInvoked',
        actionId: intent.intent.commandId,
        authority: {
          kind: 'sectionCommands',
          revision: state.sections[sectionId].sectionCommandRevision,
          sectionId,
        },
        intentId: intent.intentId,
        itemId: intent.intent.itemId,
        owner: facts.owner,
        sectionId,
        sessionId: facts.ownerToken.sessionId,
      });
    },
    [dispatchIntent, store],
  );

  const handleIntent = useCallback(
    (value: string) => {
      const parsed = parseHomeContainerIntentV3(value);
      if (!parsed || !owner || !runtime) return;
      if (
        parsed.owner.scopeKey !== owner.scopeKey ||
        parsed.owner.sessionId !== owner.sessionId
      ) {
        if (parsed.intent.kind === 'refresh') {
          nativeRef.current?.completeRefresh(parsed.intent.requestId);
        }
        return;
      }
      if (runtime.handleSpecialIntent(parsed)) return;
      const state = readHomeStoreState(store.get);
      const facts = state.facts;
      if (
        parsed.intent.kind === 'selectTab' &&
        parsed.authority.kind === 'tabApplicability'
      ) {
        if (!facts) return;
        const receipt = dispatchIntent({
          type: 'tabSelected',
          authority: parsed.authority,
          intentId: parsed.intentId,
          owner: facts.owner,
          sessionId: facts.ownerToken.sessionId,
          tabId: parsed.intent.tabId,
        });
        if (receipt?.accepted) {
          runtime.controller.recordSelectedTab(parsed.intent.tabId);
        } else {
          nativeRef.current?.selectTab(runtime.getSelectedTabId(), false);
        }
        return;
      }
      if (
        parsed.intent.kind === 'refresh' &&
        parsed.authority.kind === 'sectionCommands' &&
        isNativeHomeTabId(parsed.intent.tabId)
      ) {
        handleRefresh(
          parsed.intent.tabId,
          parsed.intent.requestId,
          parsed.authority.revision,
        );
        return;
      }
      if (
        parsed.intent.kind === 'handoff' &&
        parsed.authority.kind === 'tabApplicability' &&
        facts
      ) {
        const receipt = dispatchIntent({
          type: 'tabHandoffInvoked',
          actionId: parsed.intent.commandId,
          authority: parsed.authority,
          intentId: parsed.intentId,
          owner: facts.owner,
          sessionId: facts.ownerToken.sessionId,
          tabId: parsed.intent.tabId,
        });
        if (receipt?.accepted) {
          navigation.switchTab(ETabRoutes.WebviewPerpTrade);
        }
        return;
      }
      dispatchGenericAction(parsed);
    },
    [
      dispatchGenericAction,
      dispatchIntent,
      handleRefresh,
      navigation,
      owner,
      runtime,
      store,
    ],
  );

  const handleReady = useCallback(
    (capabilities: IHomeContainerCapabilities) => {
      const target = nativeRef.current;
      nativeCapabilitiesRef.current = capabilities;
      if (!target || !runtime) return;
      if (!runtime.controller.attach(target, capabilities)) {
        defaultLogger.app.error.log(
          '[NativeHome] controller attach failed during native readiness',
        );
        return;
      }
      attachedTargetRef.current = target;
    },
    [runtime],
  );
  useLayoutEffect(() => {
    const target = nativeRef.current;
    if (!target || !runtime) return;
    const capabilities =
      nativeCapabilitiesRef.current ?? target.getCapabilities();
    if (capabilities && runtime.controller.attach(target, capabilities)) {
      attachedTargetRef.current = target;
    }
  }, [runtime]);
  const handleRenderError = useCallback((code: string, message: string) => {
    defaultLogger.app.error.log(
      `[NativeHome] render failed: code=${code}, message=${message}`,
    );
  }, []);

  if (!owner || !runtime || !initialSnapshot || !slotBundle) return null;
  return (
    <Stack flex={1} bg="$bgApp">
      <MobileNativeHomeBridges
        nativeTheme={nativeTheme}
        owner={owner}
        runtime={runtime}
      />
      <MemoHomeTabSearchHeader />
      <HomeContainer
        ref={nativeRef}
        initialSnapshot={initialSnapshot}
        style={{ flex: 1 }}
        slotBundle={slotBundle}
        testID="NativeHomeContainer"
        onReady={handleReady}
        onIntent={handleIntent}
        onRenderError={handleRenderError}
      />
    </Stack>
  );
}
