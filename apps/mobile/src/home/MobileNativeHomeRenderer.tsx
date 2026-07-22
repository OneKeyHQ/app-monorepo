import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Stack, XStack, useTheme } from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorActiveAccount';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerHome';
import { AllNetworksManagerTrigger } from '@onekeyhq/kit/src/components/AccountSelector/AllNetworksManagerTrigger';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { HomeTabSearchHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHomeBalancePresentation } from '@onekeyhq/kit/src/hooks/useHomeBalanceState';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeCommitIdentity,
  useHomeFacts,
  useHomeNavigation,
  useHomeResource,
  useHomeSection,
  useHomeSessionState,
  useHomeShell,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { HomeTokenListProviderMirror } from '@onekeyhq/kit/src/views/Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { NotBackedUpEmpty } from '@onekeyhq/kit/src/views/Home/components/NotBakcedUp';
import { WalletActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions';
import { createHomeAuthorityId } from '@onekeyhq/kit/src/views/Home/model/core/homeIdentity';
import { useHomeSectionPayload } from '@onekeyhq/kit/src/views/Home/model/react/homeStoreHooks';
import {
  HOME_BANNER_ACTION_IDS,
  readHomeBannerStorePayload,
} from '@onekeyhq/kit/src/views/Home/model/sections/banner/homeBannerStoreModel';
import { HOME_SHELL_ACTION_IDS } from '@onekeyhq/kit/src/views/Home/model/store/homeStoreCommandIds';
import type {
  IHomeStoreEffect,
  IHomeStoreIntent,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreTypes';
import type { INativeHomePageViewProps } from '@onekeyhq/kit/src/views/Home/NativeHomePageView.types';
import { HomePageView } from '@onekeyhq/kit/src/views/Home/pages/HomePageView';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  type IHomeContainerSlotKey,
  type IHomeContainerSlots,
  type IHomeContainerSnapshot,
  type IHomeContainerTab,
  type IHomeContainerTabId,
  type IHomeContainerTheme,
  isHomeContainerAvailable,
  parseHomeContainerIntentV3,
  parseHomeContainerTransportResult,
} from '@onekeyhq/native-components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { buildMobileNativeHomeSections } from './mobileNativeHomeProjector';

const TAB_ORDER: readonly IHomeContainerTabId[] = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
];

type IRefreshState = {
  sectionId: IHomeContainerTabId;
  seenRefreshing: boolean;
  timeoutId: ReturnType<typeof setTimeout>;
};

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

export function MobileNativeHomeRenderer({
  onPressHide,
  sceneName,
}: INativeHomePageViewProps) {
  const intl = useIntl();
  const theme = useTheme();
  const navigation = useAppNavigation();
  const nativeRef = useRef<IHomeContainerRef>(null);
  const nativeCapabilitiesRef = useRef<IHomeContainerCapabilities | undefined>(
    undefined,
  );
  const [nativeUnavailable, setNativeUnavailable] = useState(
    () => !isHomeContainerAvailable(),
  );
  const session = useHomeSessionState();
  const facts = useHomeFacts();
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
  const perpsResource = useHomeResource('perps');
  const defiResource = useHomeResource('defi');
  const nftResource = useHomeResource('nft');
  const historyResource = useHomeResource('history');
  const reactBalancePresentation = useHomeBalancePresentation();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;
  const {
    activeAccount: { isOthersWallet, network },
  } = useActiveAccount({ num: 0 });
  const portfolioPayload = useHomeSectionPayload('portfolio');
  const perpsPayload = useHomeSectionPayload('perps');
  const defiPayload = useHomeSectionPayload('defi');
  const nftPayload = useHomeSectionPayload('nft');
  const historyPayload = useHomeSectionPayload('history');
  const marketPayload = useHomeSectionPayload('market');
  const bannerPayload =
    bannerResource.kind === 'ready'
      ? readHomeBannerStorePayload(bannerResource.data)
      : undefined;

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
      loading: intl.formatMessage({
        id: ETranslations.perp_token_selector_loading,
      }),
      noData: intl.formatMessage({ id: ETranslations.global_no_data }),
      popular: intl.formatMessage({ id: ETranslations.global_popular }),
      positions: intl.formatMessage({ id: ETranslations.earn_positions }),
      tokens: intl.formatMessage({
        id: ETranslations.global_universal_search_tabs_tokens,
      }),
      unableToLoad: intl.formatMessage({ id: ETranslations.global_failed }),
    }),
    [intl],
  );

  const payloads = useMemo(
    () => ({
      portfolio: portfolioPayload,
      perps: perpsPayload,
      defi: defiPayload,
      nft: nftPayload,
      history: historyPayload,
      market: marketPayload,
    }),
    [
      defiPayload,
      historyPayload,
      marketPayload,
      nftPayload,
      perpsPayload,
      portfolioPayload,
    ],
  );
  const semanticSections = useMemo(
    () => ({
      portfolio: portfolioSection.value,
      perps: perpsSection.value,
      defi: defiSection.value,
      nft: nftSection.value,
      history: historySection.value,
    }),
    [
      defiSection.value,
      historySection.value,
      nftSection.value,
      perpsSection.value,
      portfolioSection.value,
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
          sections: buildMobileNativeHomeSections({
            labels: nativeLabels,
            locale: intl.locale,
            payloads,
            sectionId: tabId,
            semantic: semanticSections[tabId],
          }),
        };
      },
    );
  }, [
    homeNavigation.value,
    intl.locale,
    nativeLabels,
    payloads,
    semanticSections,
    tabTitles,
  ]);

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
  const header = useMemo<IHomeContainerHeader>(() => {
    const balance = balanceModel
      ? formatShellBalance({
          amount: balanceModel.amount,
          currency: balanceModel.currency,
          hidden: hideValue,
        })
      : '';
    const match = hideValue ? undefined : balance.match(/^(.*)([.,]\d+)$/);
    const showBanners =
      funded && balancePresentation?.banner.kind === 'positive';
    let actionLayout: IHomeContainerHeader['actionLayout'] = 'loading';
    if (balancePresentation?.kind === 'zero') {
      actionLayout = 'zeroBalance';
    } else if (balanceModel) {
      actionLayout = 'standard';
    }
    let actionRowHeight = 96;
    if (isBackupRequired) {
      actionRowHeight = 0;
    } else if (reactBalancePresentation.balanceState === 'zero') {
      actionRowHeight = 112;
    }
    return {
      accountName: '',
      balance: match?.[1] ?? balance,
      balanceSecondary: match?.[2],
      balanceActionId: balanceModel ? HOME_SHELL_ACTION_IDS.balance : undefined,
      actionRowHeight,
      actionLayout: isBackupRequired ? 'standard' : actionLayout,
      actions: [],
      banners: showBanners
        ? (bannerPayload?.banners ?? []).map((banner) => ({
            id: banner.id,
            title: banner.title,
            subtitle: banner.description,
            imageUrl: banner.src,
            actionId: HOME_BANNER_ACTION_IDS.open,
            dismissActionId: banner.closeable
              ? HOME_BANNER_ACTION_IDS.dismiss
              : undefined,
          }))
        : [],
    };
  }, [
    balanceModel,
    balancePresentation,
    bannerPayload?.banners,
    funded,
    hideValue,
    isBackupRequired,
    reactBalancePresentation.balanceState,
  ]);

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
      headerActionRow: isBackupRequired
        ? undefined
        : {
            interaction: 'tap',
            authority: actionRowAuthority,
            height: header.actionRowHeight,
            content: (
              <HomeTokenListProviderMirror>
                <WalletActions balancePresentation={reactBalancePresentation} />
              </HomeTokenListProviderMirror>
            ),
          },
      contentStates: backupStateAuthority
        ? {
            portfolio: {
              interaction: 'tap',
              authority: backupStateAuthority,
              content: <NotBackedUpEmpty />,
              height: 320,
            },
          }
        : undefined,
    }),
    [
      accountRowAuthority,
      actionRowAuthority,
      backupStateAuthority,
      header.actionRowHeight,
      isBackupRequired,
      isOthersWallet,
      nativeTheme.backgroundColor,
      network?.isAllNetworks,
      reactBalancePresentation,
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
      slotRevisions: {
        ...(accountRowAuthority
          ? { [accountRowAuthority.slotId]: accountRowAuthority.slotRevision }
          : {}),
        ...(actionRowAuthority
          ? { [actionRowAuthority.slotId]: actionRowAuthority.slotRevision }
          : {}),
        ...(backupStateAuthority
          ? { [backupStateAuthority.slotId]: backupStateAuthority.slotRevision }
          : {}),
      },
    }),
    [
      accountRowAuthority,
      actionRowAuthority,
      backupStateAuthority,
      commitIdentity.storeCommitId,
      defiSection,
      historySection,
      homeNavigation,
      marketSection,
      nftSection,
      perpsSection,
      portfolioSection,
      shell,
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
  const previousSnapshotRef = useRef(snapshot);
  const attachedTargetRef = useRef<IHomeContainerRef | undefined>(undefined);

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

  useEffect(
    () => () => {
      controller?.detach(attachedTargetRef.current);
      controller?.dispose();
    },
    [controller],
  );

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
      setNativeUnavailable(true);
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
    const shouldShowBanner =
      funded &&
      balancePresentation?.banner.kind === 'positive' &&
      bannerCount > 0;
    defaultLogger.wallet.homeUi.homeRendererDecision({
      renderer: nativeUnavailable ? 'react' : 'native',
      reason: nativeUnavailable ? 'capabilityUnavailable' : 'platformDefault',
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
      hasTronResource: Boolean(bannerPayload?.tronResource),
      hasWalletBannerContent:
        bannerCount > 0 || Boolean(bannerPayload?.tronResource),
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
    bannerResource.kind,
    facts?.owner.network.kind,
    funded,
    header.balance,
    header.balanceSecondary,
    homeNavigation.value,
    isBackupRequired,
    nativeUnavailable,
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
        storeIntent = {
          type: 'sectionActionInvoked',
          actionId: intent.intent.commandId,
          authority,
          execution: 'controller',
          intentId: intent.intentId,
          itemId: intent.intent.itemId,
          owner: facts.owner,
          sectionId: authority.sectionId,
          sessionId: facts.ownerToken.sessionId,
        };
      } else {
        return;
      }
      dispatchHomeIntent(storeIntent);
    },
    [dispatchHomeIntent, facts],
  );

  const pendingRefreshesRef = useRef(new Map<string, IRefreshState>());
  const handleRefreshIntent = useCallback(
    (tabId: IHomeContainerTabId, requestId: string, revision: number) => {
      if (!facts) {
        nativeRef.current?.completeRefresh(requestId);
        return;
      }
      let actionId = `home.${tabId}.refresh`;
      if (tabId === 'defi') {
        actionId = 'home.defi.refresh';
      } else if (tabId === 'history') {
        actionId = 'home.history.refresh';
      }
      const effects = dispatchHomeIntent({
        type: 'sectionRefreshRequested',
        actionId,
        authority: {
          kind: 'sectionCommands',
          revision,
          sectionId: tabId,
        },
        execution: 'controller',
        intentId: createHomeAuthorityId('intent'),
        owner: facts.owner,
        sectionId: tabId,
        sessionId: facts.ownerToken.sessionId,
      });
      if (!didAcceptIntent(effects)) {
        nativeRef.current?.completeRefresh(requestId);
        return;
      }
      const timeoutId = setTimeout(() => {
        nativeRef.current?.completeRefresh(requestId);
        pendingRefreshesRef.current.delete(requestId);
      }, 15_000);
      pendingRefreshesRef.current.set(requestId, {
        sectionId: tabId,
        seenRefreshing: false,
        timeoutId,
      });
    },
    [dispatchHomeIntent, facts],
  );

  useEffect(() => {
    const resources = {
      portfolio: portfolioResource,
      perps: perpsResource,
      defi: defiResource,
      nft: nftResource,
      history: historyResource,
    };
    pendingRefreshesRef.current.forEach((pending, requestId) => {
      const resource = resources[pending.sectionId];
      const refreshing =
        resource.kind === 'loading' ||
        resource.kind === 'partial' ||
        ((resource.kind === 'ready' || resource.kind === 'empty') &&
          resource.refresh === 'refreshing');
      if (refreshing) {
        pending.seenRefreshing = true;
      } else if (pending.seenRefreshing) {
        clearTimeout(pending.timeoutId);
        nativeRef.current?.completeRefresh(requestId);
        pendingRefreshesRef.current.delete(requestId);
      }
    });
  }, [
    defiResource,
    historyResource,
    nftResource,
    perpsResource,
    portfolioResource,
  ]);

  useEffect(
    () => () => {
      const target = nativeRef.current;
      pendingRefreshesRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId);
      });
      pendingRefreshesRef.current.forEach((_pending, requestId) => {
        target?.completeRefresh(requestId);
      });
      pendingRefreshesRef.current.clear();
    },
    [owner?.scopeKey, owner?.sessionId],
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
      if (parsed.intent.kind === 'selectTab') {
        if (dispatchTabIntent(parsed.intent.tabId, parsed.authority.revision)) {
          controller?.recordSelectedTab(parsed.intent.tabId);
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
      dispatchHomeIntent,
      dispatchNativeAction,
      dispatchTabIntent,
      facts,
      handleRefreshIntent,
      navigation,
      owner,
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
        setNativeUnavailable(true);
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

  if (nativeUnavailable || !owner || !controller) {
    return <HomePageView sceneName={sceneName} onPressHide={onPressHide} />;
  }

  return (
    <Stack flex={1} bg="$bgApp">
      <HomeTabSearchHeader />
      <HomeContainer
        ref={nativeRef}
        style={{ flex: 1 }}
        slotBundle={slotBundle}
        testID="NativeHomeContainer"
        fallback={
          <HomePageView sceneName={sceneName} onPressHide={onPressHide} />
        }
        onReady={handleReady}
        onIntent={handleIntent}
        onTransportResult={handleTransportResult}
        onRenderError={() => setNativeUnavailable(true)}
      />
    </Stack>
  );
}
