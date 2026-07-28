import {
  Profiler,
  type ProfilerOnRenderCallback,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useAccountOverviewContextStore } from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import {
  useActiveAccount,
  useIsAccountSelectorSyncLoading,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeContextStore,
  useHomeSessionState,
  useHomeShell,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { shouldBlockBotWalletCopyAddress } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { onNativeBackgroundThreadReady } from '@onekeyhq/shared/src/background/nativeBackgroundThreadReady';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  HOME_RUNTIME_PROTOCOL_VERSION,
  type IHomeRuntimeOwnerScope,
} from '@onekeyhq/shared/src/types/homeRuntime';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { createHomeAuthorityId } from '../core/homeIdentity';
import { adaptCurrentHomeFacts } from '../facts/currentHomeFactsAdapter';
import {
  getHomeHostVisible,
  subscribeHomeHostVisibility,
} from '../runtime/homeHostLifecycleAdapter';
import {
  type IHomeRuntimeEffectExecutors,
  acquireHomeRuntime,
} from '../runtime/homeRuntimeLease';
import { homeTokenListRuntime } from '../tokenList/homeTokenListRuntime';

import { useHomeCommandExecutor } from './useHomeCommandExecutor';

import type { IHomeHeaderAccountPresentation } from '../presentation/homeHeaderPresentation';

export function HomeRuntimeRoot({
  children,
  mode,
}: PropsWithChildren<{ mode: 'wallet' | 'urlAccount' }>) {
  const store = useHomeContextStore();
  const intl = useIntl();
  const routeIsFocused = useRouteIsFocused();
  const session = useHomeSessionState();
  const shell = useHomeShell();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountOverviewStore = useAccountOverviewContextStore();
  const {
    account,
    dbAccount,
    indexedAccount,
    isOthersWallet,
    network,
    ready,
    wallet,
  } = activeAccount;
  const isAccountSelectorSyncLoading = useIsAccountSelectorSyncLoading(0);
  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );
  const shouldLoadCompatibleNetworks = Boolean(
    network?.isAllNetworks &&
    wallet?.id &&
    !accountUtils.isOthersWallet({ walletId: wallet.id }),
  );
  const {
    enabledNetworksCompatibleWithWalletId,
    enabledNetworksWithoutAccount,
    isReady: compatibleNetworksReady,
    run: refreshCompatibleNetworks,
  } = useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
    walletId: shouldLoadCompatibleNetworks ? (wallet?.id ?? '') : '',
    networkId: network?.id,
    indexedAccountId: indexedAccount?.id,
    filterNetworksWithoutAccount: true,
  });
  useEffect(() => {
    const refresh = () => {
      void refreshCompatibleNetworks({ alwaysSetState: true });
    };
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.NetworkDeriveTypeChanged, refresh);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
    };
  }, [refreshCompatibleNetworks]);
  const headerAccountPresentation = useMemo<IHomeHeaderAccountPresentation>(
    () => ({
      account,
      accountName: activeAccount.accountName,
      compatibleNetworks: enabledNetworksCompatibleWithWalletId,
      compatibleNetworksReady:
        !shouldLoadCompatibleNetworks || compatibleNetworksReady,
      compatibleNetworksWithoutAccountCount:
        enabledNetworksWithoutAccount.length,
      copyDisabled: shouldBlockBotWalletCopyAddress({
        isBotWallet,
        isBotWalletDeactivated,
      }),
      dbAccount,
      indexedAccount,
      isAccountSelectorSyncLoading,
      isAllNetworks: Boolean(network?.isAllNetworks),
      isOthersWallet: Boolean(isOthersWallet),
      network,
      ready,
      wallet,
    }),
    [
      account,
      activeAccount.accountName,
      compatibleNetworksReady,
      dbAccount,
      enabledNetworksCompatibleWithWalletId,
      enabledNetworksWithoutAccount.length,
      indexedAccount,
      isAccountSelectorSyncLoading,
      isBotWallet,
      isBotWalletDeactivated,
      isOthersWallet,
      network,
      ready,
      shouldLoadCompatibleNetworks,
      wallet,
    ],
  );
  const [settings] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const runtimeLease = useMemo(
    () => acquireHomeRuntime(store, { mode }),
    [mode, store],
  );
  const { runtime } = runtimeLease;
  useLayoutEffect(() => {
    runtimeLease.retain();
    return () => {
      runtimeLease.release();
    };
  }, [runtimeLease]);
  const executeHomeCommand = useHomeCommandExecutor(runtime);
  const owner = useMemo<IHomeRuntimeOwnerScope | undefined>(() => {
    if (!ready || !wallet?.id || !account?.id || !network?.id) {
      return undefined;
    }
    return {
      walletId: wallet.id,
      accountId: account.id,
      network: network.isAllNetworks
        ? { kind: 'allNetworks' }
        : { kind: 'singleNetwork', networkId: network.id },
    };
  }, [account?.id, network?.id, network?.isAllNetworks, ready, wallet?.id]);

  const effectExecutors = useMemo<IHomeRuntimeEffectExecutors>(() => {
    const connectRuntime = async () => {
      try {
        const handshake =
          platformEnv.isNative || platformEnv.isExtension
            ? await backgroundApiProxy.serviceBootstrap.getHomeRuntimeHandshake()
            : {
                protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
                producerInstanceId: runtime.identity.runtimeInstanceId,
                appEpoch: runtime.identity.runtimeInstanceId,
              };
        runtime.dispatch({
          type: 'sessionEvent',
          event: {
            type: 'runtimeHandshakeSucceeded',
            appEpoch: handshake.appEpoch,
            producerInstanceId: handshake.producerInstanceId,
          },
        });
      } catch {
        runtime.dispatch({
          type: 'sessionEvent',
          event: { type: 'runtimeHandshakeFailed', exhausted: true },
        });
      }
    };
    return {
      connectRuntime: async () => connectRuntime(),
      recoverRuntime: async () => connectRuntime(),
      executeCommand: async (envelope) => {
        const handled = await runtime.sources.executeCommand(
          envelope.effect.intent,
        );
        if (handled) {
          return undefined;
        }
        return executeHomeCommand(envelope.effect.intent);
      },
      reconcileSourcePlan: () => runtime.sources.reconcile(),
      traceReject: () => undefined,
    };
  }, [executeHomeCommand, runtime]);

  useLayoutEffect(() => {
    runtime.setEffectExecutors(effectExecutors);
  }, [effectExecutors, runtime]);

  useLayoutEffect(() => {
    if (runtime.capabilities.sourceExecution) {
      runtime.sources.updateEnvironment({
        activeAccount,
        bannerLabels: {
          referralDescription: intl.formatMessage({
            id: ETranslations.perps__claim_fee_discount_short__desc,
          }),
          referralTitle: intl.formatMessage({
            id: ETranslations.perps__claim_fee_discount__title,
          }),
        },
        currencyMap,
        settings,
      });
    }
  }, [activeAccount, currencyMap, intl, runtime, settings]);

  useLayoutEffect(() => {
    if (runtime.capabilities.persistence) {
      runtime.persistence.updateEnvironment(
        {
          activeAccount,
          currencyMap,
        },
        accountOverviewStore,
      );
    }
  }, [accountOverviewStore, activeAccount, currencyMap, runtime]);

  useLayoutEffect(() => {
    runtime.dispatch({
      type: 'runtimeAcquired',
      mode,
      runtimeInstanceId: runtime.identity.runtimeInstanceId,
      clientInstanceId: runtime.identity.clientInstanceId,
      appEpoch: runtime.identity.runtimeInstanceId,
      topology:
        platformEnv.isNative || platformEnv.isExtension ? 'split' : 'single',
    });
  }, [mode, runtime]);

  useLayoutEffect(() => {
    const startedAt = Date.now();
    const previousSessionId = runtime.getState().session.ownerToken?.sessionId;
    const labels = {
      walletName: wallet?.name,
      accountName: indexedAccount?.name || account?.name,
    };
    runtime.replaceOwner(owner, labels, headerAccountPresentation);
    const nextSessionId = runtime.getState().session.ownerToken?.sessionId;
    if (
      !owner ||
      !nextSessionId ||
      nextSessionId === previousSessionId ||
      typeof requestAnimationFrame !== 'function'
    ) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      defaultLogger.wallet.homeFramePerf.frame({
        stage: 'firstOwnerFrame',
        ...labels,
        elapsedMs: Date.now() - startedAt,
      });
    });
    return () => {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frame);
      }
    };
  }, [
    account?.name,
    headerAccountPresentation,
    indexedAccount?.name,
    owner,
    runtime,
    wallet?.name,
  ]);

  useLayoutEffect(() => {
    const ownerToken = runtime.getState().session.ownerToken;
    if (!owner || !ownerToken) {
      return;
    }
    runtime.dispatch({
      type: 'headerAccountPresentationChanged',
      ownerToken,
      presentation: headerAccountPresentation,
    });
  }, [headerAccountPresentation, owner, runtime]);

  useEffect(() => {
    const publishVisibility = (appVisible: boolean) => {
      runtime.dispatchAtomically([
        {
          type: 'sessionEvent',
          event: {
            type: 'appActivityChanged',
            appActivity: appVisible ? 'active' : 'background',
          },
        },
        {
          type: 'sessionEvent',
          event: {
            type: 'surfaceVisibilityChanged',
            surfaceVisibility:
              appVisible && routeIsFocused ? 'visible' : 'hidden',
          },
        },
      ]);
    };
    publishVisibility(getHomeHostVisible());
    return subscribeHomeHostVisibility(publishVisibility);
  }, [routeIsFocused, runtime]);

  useEffect(() => {
    runtime.dispatch({
      type: 'sessionEvent',
      event: {
        type: 'surfaceVisibilityChanged',
        surfaceVisibility:
          getHomeHostVisible() && routeIsFocused ? 'visible' : 'hidden',
      },
    });
  }, [routeIsFocused, runtime]);

  useEffect(() => {
    if (
      !owner ||
      !session.ownerToken ||
      session.authority === 'idle' ||
      session.authority === 'stopped'
    ) {
      return;
    }
    const facts = adaptCurrentHomeFacts({
      owner,
      authority: {
        authority: session.authority,
        ownerToken: session.ownerToken,
        producerInstanceId: session.producerInstanceId,
        topology:
          platformEnv.isNative || platformEnv.isExtension ? 'split' : 'single',
      },
      wallet: {
        ready: true,
        backuped: wallet?.backuped,
        type: wallet?.type,
      },
      network: {
        hasAccount: Boolean(account),
        family: network?.impl,
      },
    });
    if (facts) {
      runtime.dispatch({ type: 'factsChanged', facts });
    }
  }, [
    account,
    network?.impl,
    owner,
    runtime,
    session.authority,
    session.ownerToken,
    session.producerInstanceId,
    wallet?.backuped,
    wallet?.type,
  ]);

  useEffect(() => {
    if (!(platformEnv.isNative || platformEnv.isExtension)) {
      return;
    }
    let lastSequence = 0;
    return onNativeBackgroundThreadReady(
      (signal) => {
        if (signal.sequence <= lastSequence) {
          return;
        }
        lastSequence = signal.sequence;
        if (signal.reason === 'restarted') {
          runtime.dispatch({
            type: 'sessionEvent',
            event: {
              type: 'runtimeRecovered',
              recoverySequence: signal.sequence,
            },
          });
        }
      },
      { replayLatest: true },
    );
  }, [runtime]);

  useEffect(() => {
    if (!runtime.capabilities.sourceExecution) {
      return;
    }
    const invalidateAccounts = () => {
      void backgroundApiProxy.serviceAccount.clearAccountNameFromAddressCache();
      runtime.sources.invalidateAllNetworkAccounts();
    };
    const invalidateWalletAccounts = ({ walletId }: { walletId: string }) => {
      void backgroundApiProxy.serviceAccount.clearAccountNameFromAddressCache();
      runtime.sources.invalidateAllNetworkAccounts(walletId);
    };
    const clearAccountNameCache = () => {
      void backgroundApiProxy.serviceAccount.clearAccountNameFromAddressCache();
    };
    const refreshVisible = () => {
      runtime.sources.refreshVisibleSources();
    };
    const refreshPortfolio = () => {
      runtime.sources.refreshSource('portfolio');
    };
    const refreshHistory = () => {
      runtime.sources.refreshSource('history');
    };
    const refreshMarket = () => {
      runtime.sources.refreshSource('market');
    };
    const capabilityChanged = () => {
      runtime.sources.invalidateAllNetworkAccounts();
      runtime.sources.refreshSource('capability');
    };
    const refreshDeFi = () => {
      runtime.sources.refreshSource('defi');
    };
    const refreshPerps = () => {
      runtime.sources.refreshSource('perps');
    };
    const switchHomeTab = ({
      id,
    }: {
      id: 'portfolio' | 'perps' | 'defi' | 'nft' | 'history';
    }) => {
      const state = runtime.getState();
      const facts = state.facts;
      const navigation = state.navigation.value;
      if (!facts || navigation.kind !== 'ready') {
        return;
      }
      const intentId = createHomeAuthorityId('intent');
      if (navigation.destinations?.[id] === 'web' && id === 'perps') {
        runtime.dispatch({
          type: 'intentReceived',
          intent: {
            type: 'tabHandoffInvoked',
            actionId: 'home.perps.openWeb',
            authority: {
              kind: 'tabApplicability',
              revision: state.navigation.tabApplicabilityRevision,
            },
            intentId,
            owner: facts.owner,
            sessionId: facts.ownerToken.sessionId,
            tabId: id,
          },
        });
        return;
      }
      runtime.dispatch({
        type: 'intentReceived',
        intent: {
          type: 'tabSelected',
          authority: {
            kind: 'tabApplicability',
            revision: state.navigation.tabApplicabilityRevision,
          },
          intentId,
          owner: facts.owner,
          sessionId: facts.ownerToken.sessionId,
          tabId: id,
        },
      });
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, invalidateAccounts);
    appEventBus.on(EAppEventBusNames.AccountUpdate, invalidateAccounts);
    appEventBus.on(EAppEventBusNames.AccountRemove, invalidateAccounts);
    appEventBus.on(
      EAppEventBusNames.AddDBAccountsToWallet,
      invalidateWalletAccounts,
    );
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refreshVisible);
    appEventBus.on(EAppEventBusNames.NetworkDeriveTypeChanged, refreshVisible);
    appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, refreshVisible);
    appEventBus.on(EAppEventBusNames.RefreshTokenList, refreshPortfolio);
    appEventBus.on(EAppEventBusNames.RefreshHistoryList, refreshHistory);
    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, refreshHistory);
    appEventBus.on(
      EAppEventBusNames.ClearLocalHistoryPendingTxs,
      refreshHistory,
    );
    appEventBus.on(EAppEventBusNames.DeFiPositionRefreshed, refreshDeFi);
    appEventBus.on(EAppEventBusNames.LocalPendingTxConfirmed, refreshPerps);
    appEventBus.on(EAppEventBusNames.RefreshMarketWatchList, refreshMarket);
    appEventBus.on(EAppEventBusNames.EnabledNetworksChanged, capabilityChanged);
    appEventBus.on(EAppEventBusNames.AddressBookUpdate, clearAccountNameCache);
    appEventBus.on(EAppEventBusNames.SwitchWalletHomeTab, switchHomeTab);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, invalidateAccounts);
      appEventBus.off(EAppEventBusNames.AccountUpdate, invalidateAccounts);
      appEventBus.off(EAppEventBusNames.AccountRemove, invalidateAccounts);
      appEventBus.off(
        EAppEventBusNames.AddDBAccountsToWallet,
        invalidateWalletAccounts,
      );
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refreshVisible);
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        refreshVisible,
      );
      appEventBus.off(EAppEventBusNames.GlobalDeriveTypeUpdate, refreshVisible);
      appEventBus.off(EAppEventBusNames.RefreshTokenList, refreshPortfolio);
      appEventBus.off(EAppEventBusNames.RefreshHistoryList, refreshHistory);
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, refreshHistory);
      appEventBus.off(
        EAppEventBusNames.ClearLocalHistoryPendingTxs,
        refreshHistory,
      );
      appEventBus.off(EAppEventBusNames.DeFiPositionRefreshed, refreshDeFi);
      appEventBus.off(EAppEventBusNames.LocalPendingTxConfirmed, refreshPerps);
      appEventBus.off(EAppEventBusNames.RefreshMarketWatchList, refreshMarket);
      appEventBus.off(
        EAppEventBusNames.EnabledNetworksChanged,
        capabilityChanged,
      );
      appEventBus.off(
        EAppEventBusNames.AddressBookUpdate,
        clearAccountNameCache,
      );
      appEventBus.off(EAppEventBusNames.SwitchWalletHomeTab, switchHomeTab);
    };
  }, [runtime]);

  useEffect(() => {
    const presentation =
      shell.value.kind === 'portfolio' ? shell.value.presentation : undefined;
    const balanceReady =
      presentation?.kind === 'funded' || presentation?.kind === 'zero';
    if (!balanceReady || (globalThis as any).__onekeyBalanceDisplayed) {
      return;
    }
    (globalThis as any).__onekeyBalanceDisplayed = true;
    appEventBus.emit(EAppEventBusNames.HomePageReady, undefined);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NativeLogger: NL, LogLevel: LL } =
        require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
      const jsEntry: number =
        (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || 0;
      if (jsEntry) {
        NL.write(
          LL.Info,
          `[StartupTiming] Balance displayed (+${Date.now() - jsEntry}ms)`,
        );
      }
    } catch {
      // Native logging is optional on non-Native targets.
    }
  }, [shell.value]);

  useEffect(() => {
    if (!runtime.capabilities.sourceExecution) {
      return undefined;
    }
    return homeTokenListRuntime.subscribeDemands((demands) => {
      runtime.sources.updateTokenListDemands(demands);
    });
  }, [runtime]);

  useEffect(() => {
    if (
      !runtime.capabilities.sourceExecution ||
      !session.ownerToken ||
      session.surfaceVisibility !== 'visible'
    ) {
      return undefined;
    }
    return homeTokenListRuntime.acquireDemand({
      consumerId: runtime.identity.clientInstanceId,
      ownerScopeKey: session.ownerToken.scopeKey,
      priority: 'critical',
      reason: 'homeVisible',
    });
  }, [runtime, session.ownerToken, session.surfaceVisibility]);

  const handleHomeProfilerRender = useCallback<ProfilerOnRenderCallback>(
    (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
      defaultLogger.wallet.homeFramePerf.frame({
        stage: 'functionTiming',
        functionName: `ReactProfiler.${id}`,
        durationMs: actualDuration,
        phase,
        walletName: wallet?.name,
        accountName: indexedAccount?.name || account?.name,
        baseDurationMs: baseDuration,
        startTimeMs: startTime,
        commitTimeMs: commitTime,
      });
    },
    [account?.name, indexedAccount?.name, wallet?.name],
  );

  return (
    <Profiler id="HomeRuntimeChildren" onRender={handleHomeProfilerRender}>
      {children}
    </Profiler>
  );
}
