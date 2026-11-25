import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Dialog } from '@onekeyhq/components';
import {
  appIsLocked,
  tradingModeAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  type IAppEventBusPayload,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { getCurrentVisibilityState } from '@onekeyhq/shared/src/utils/appVisibility';
import {
  type INotificationPageNavigationEvent,
  ackNotificationRead,
  navigateToNotificationDetailByLocalParams,
  registerNotificationPageNavigationProcessor,
} from '@onekeyhq/shared/src/utils/notificationsUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  ENotificationCommand,
  ENotificationViewDialogActionType,
} from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useReferFriends } from '../../../hooks/useReferFriends';
import { useVersionCompatible } from '../../../hooks/useVersionCompatible';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector/atoms';
import { isForceUpdateUiActive } from '../../../views/AppUpdate/hooks/forceUpdateSurfaces';
import { openWebView } from '../../../views/WebView/utils/webViewNavigation';

import { executeNotificationCommand } from './commandRegistry';
import { useInitialNotification } from './hooks';
import {
  NotificationHandlerDiscoveryProvider,
  useNotificationDappNavigation,
} from './NotificationDappNavigation';
import { recoverPerpsSubscriptionsAfterNavigation } from './perpsSubscriptionRecovery';

const canPresentNotification = () => !isForceUpdateUiActive();

function BaseNotificationHandlerContainer() {
  const { showFallbackUpdateDialog } = useVersionCompatible();
  const navigation = useAppNavigation();
  const { toInviteRewardPage, openHardwareSalesOrderDetail } =
    useReferFriends();

  const { activeAccount } = useActiveAccount({ num: 0 });
  const activeAccountRef = useRef(activeAccount);
  activeAccountRef.current = activeAccount;

  const getLocalParams = useCallback(
    () => ({
      accountId: activeAccountRef.current?.account?.id,
      indexedAccountId: activeAccountRef.current?.indexedAccount?.id,
      networkId: activeAccountRef.current?.network?.id,
      walletId: activeAccountRef.current?.wallet?.id,
      accountName: activeAccountRef.current?.account?.name,
      deriveType: activeAccountRef.current?.deriveType,
      avatarUrl: activeAccountRef.current?.wallet?.avatar,
    }),
    [],
  );

  const handleShowNotificationDappNavigation =
    useNotificationDappNavigation(navigation);

  useEffect(() => {
    const handleShowFallbackUpdateDialog = ({
      version,
    }: {
      version: string | null | undefined;
    }) => {
      if (isForceUpdateUiActive()) {
        return;
      }
      showFallbackUpdateDialog(version);
    };
    appEventBus.on(
      EAppEventBusNames.ShowFallbackUpdateDialog,
      handleShowFallbackUpdateDialog,
    );
    const handleShowNotificationViewDialog = ({
      payload: payloadObj,
      readNotificationId,
    }: IAppEventBusPayload[EAppEventBusNames.ShowNotificationViewDialog]) => {
      if (isForceUpdateUiActive()) {
        return;
      }
      const localParams = getLocalParams();
      const { onConfirm, ...rest } = payloadObj;
      Dialog.show({
        ...rest,
        onConfirm: async () => {
          if (isForceUpdateUiActive()) {
            return;
          }
          const { actionType, payload } = onConfirm;
          switch (actionType) {
            case ENotificationViewDialogActionType.navigate:
              try {
                await navigateToNotificationDetailByLocalParams({
                  payload: payload as any,
                  localParams,
                  getEarnAccount: (props) =>
                    backgroundApiProxy.serviceStaking.getEarnAccount(props),
                });
              } catch (_error) {
                if (canPresentNotification()) showFallbackUpdateDialog(null);
              }
              break;
            case ENotificationViewDialogActionType.openInApp:
              openWebView({ url: payload as string, source: 'notification' });
              break;
            case ENotificationViewDialogActionType.openInBrowser:
              // The dialog protocol's openInBrowser action promises the OS
              // browser; openInApp above is the in-app counterpart.
              openUrlExternal(payload as string, {
                useSystemBrowser: true,
              });
              break;
            default:
              break;
          }
        },
      });
      ackNotificationRead(readNotificationId);
    };
    appEventBus.on(
      EAppEventBusNames.ShowNotificationViewDialog,
      handleShowNotificationViewDialog,
    );
    const handleShowNotificationPageNavigation = async (
      event: INotificationPageNavigationEvent,
    ) => {
      if (isForceUpdateUiActive()) return;
      const { readNotificationId } = event;
      if (event.browserUrl !== undefined) {
        openUrlExternal(event.browserUrl, {
          useSystemBrowser: true,
          onNativeSystemBrowserOpened: () =>
            ackNotificationRead(readNotificationId),
        });
        return;
      }
      const { payload: payloadObj, extras, navigationAction } = event;
      const localParams = getLocalParams();

      const isPerpNavigation =
        payloadObj.screen === 'main' &&
        payloadObj.params?.screen === ETabRoutes.Perp;

      if (isPerpNavigation) {
        setPerpPageEnterSource(EPerpPageEnterSource.Notification);
      }

      const perpToken = isPerpNavigation
        ? (payloadObj.params?.params as { token?: string } | undefined)
            ?.token || extras?.params?.coin
        : null;

      if (perpToken) {
        try {
          // Recorded before the atom write so no cold start can observe the
          // coin without it: on that path the Perp page restores its persisted
          // instrument, which predates this tap and would win. Isolated because
          // losing it only costs that restore — it must not skip the writes and
          // the event below.
          await backgroundApiProxy.serviceHyperliquid.setPendingInitialTradeInstrument(
            { coin: perpToken, mode: 'perp' },
          );
        } catch {
          // ignore
        }
        try {
          if (isForceUpdateUiActive()) return;
          await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
            coin: perpToken,
          });
          // changeActiveAsset only writes perpsActiveAssetAtom, so a leftover
          // spot mode would make the resync read spotActiveAssetAtom and drop
          // this coin.
          if (isForceUpdateUiActive()) return;
          await tradingModeAtom.set('perp');
          if (isForceUpdateUiActive()) return;
          // Notify an already-mounted Perp page (via PerpsGlobalEffects) to
          // switch its active instrument; without this the coin switch is a
          // no-op when the Perp page was already opened (banner deep-link case).
          appEventBus.emit(EAppEventBusNames.PerpSwitchActiveInstrument, {
            mode: 'perp',
            coin: perpToken,
          });
          // Start the reconnect now so it overlaps the ~350ms of
          // popToMainRoute + wait, rather than waiting for route focus.
          // Never while locked: resumeSubscriptions enables the handler
          // unconditionally, and the user has to unlock before anything
          // renders anyway — unlock recovery resumes on its own.
          const isAppLocked = await appIsLocked.get();
          if (!isAppLocked) {
            void backgroundApiProxy.serviceHyperliquidSubscription
              .resumeSubscriptions()
              .catch((error) => {
                defaultLogger.perp.hyperliquid.coldStartInitializationError({
                  type: 'prewarm_subscriptions',
                  coin: perpToken,
                  error,
                });
              });
          }
        } catch (error) {
          console.error('Failed to change perps active asset:', error);
        }
      }

      if (isForceUpdateUiActive()) return;
      try {
        const navigated = await navigateToNotificationDetailByLocalParams({
          payload: payloadObj,
          navigationAction,
          localParams,
          getEarnAccount: (props) =>
            backgroundApiProxy.serviceStaking.getEarnAccount(props),
        });
        if (!navigated) return;
        ackNotificationRead(readNotificationId);
        await timerUtils.wait(0);
        if (isPerpNavigation) {
          await recoverPerpsSubscriptionsAfterNavigation({
            isAppVisible: getCurrentVisibilityState,
            isAppLocked: () => appIsLocked.get(),
            readDisabledCount: () =>
              backgroundApiProxy.serviceHyperliquidSubscription.getSubscriptionsHandlerDisabledCount(),
            recover: (disabledCount) =>
              backgroundApiProxy.serviceHyperliquidSubscription.recoverSubscriptionsAfterLivenessProof(
                { disabledCount },
              ),
          });
        }
      } catch (error) {
        console.error(error);
        if (canPresentNotification()) showFallbackUpdateDialog(null);
      }
    };
    const handleShowNotificationInDappPage = ({
      url,
      readNotificationId,
    }: IAppEventBusPayload[EAppEventBusNames.ShowNotificationInDappPage]) => {
      if (isForceUpdateUiActive()) return;
      handleShowNotificationDappNavigation(url, {
        canPresent: canPresentNotification,
        onPresented: () => ackNotificationRead(readNotificationId),
      });
    };
    const handleShowNotificationInWebViewOverlay = ({
      params,
      readNotificationId,
    }: IAppEventBusPayload[EAppEventBusNames.ShowNotificationInWebViewOverlay]) => {
      if (isForceUpdateUiActive()) return;
      if (openWebView(params)) {
        ackNotificationRead(readNotificationId);
      }
    };
    // Pull the BG-owned legacy intent after the UI processor registers. The
    // event wake may have arrived before main installed its SharedRPC observer.
    const unregisterPageNavigationProcessor =
      registerNotificationPageNavigationProcessor(
        handleShowNotificationPageNavigation,
        platformEnv.isNativeMainThread &&
          platformEnv.enableNativeBackgroundThread
          ? () =>
              backgroundApiProxy.serviceNotification.consumePendingLegacyNavigation()
          : undefined,
        canPresentNotification,
      );
    appEventBus.on(
      EAppEventBusNames.ShowNotificationInDappPage,
      handleShowNotificationInDappPage,
    );
    appEventBus.on(
      EAppEventBusNames.ShowNotificationInWebViewOverlay,
      handleShowNotificationInWebViewOverlay,
    );

    const handleExecuteCommand = async ({
      action,
      data,
      readNotificationId,
    }: IAppEventBusPayload[EAppEventBusNames.ExecuteNotificationCommand]) => {
      if (
        isForceUpdateUiActive() &&
        action !== ENotificationCommand.openSupportConversation
      ) {
        return;
      }
      try {
        const success = await executeNotificationCommand(
          action,
          {
            toInviteRewardPage,
            openHardwareSalesOrderDetail,
            presentation: {
              canPresent: canPresentNotification,
              onPresented: () => ackNotificationRead(readNotificationId),
            },
          },
          data,
        );
        if (!success && canPresentNotification()) {
          showFallbackUpdateDialog(null);
        }
      } catch (error) {
        if (canPresentNotification()) errorToastUtils.showToastOfError(error);
      }
    };
    appEventBus.on(
      EAppEventBusNames.ExecuteNotificationCommand,
      handleExecuteCommand,
    );
    void handleExecuteCommand({
      action: ENotificationCommand.openSupportConversation,
    });

    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowFallbackUpdateDialog,
        handleShowFallbackUpdateDialog,
      );
      appEventBus.off(
        EAppEventBusNames.ShowNotificationViewDialog,
        handleShowNotificationViewDialog,
      );
      unregisterPageNavigationProcessor();
      appEventBus.off(
        EAppEventBusNames.ShowNotificationInDappPage,
        handleShowNotificationInDappPage,
      );
      appEventBus.off(
        EAppEventBusNames.ShowNotificationInWebViewOverlay,
        handleShowNotificationInWebViewOverlay,
      );
      appEventBus.off(
        EAppEventBusNames.ExecuteNotificationCommand,
        handleExecuteCommand,
      );
    };
  }, [
    getLocalParams,
    handleShowNotificationDappNavigation,
    showFallbackUpdateDialog,
    toInviteRewardPage,
    openHardwareSalesOrderDetail,
  ]);
  useInitialNotification();
  return null;
}

export function NotificationHandlerContainer() {
  const config = useMemo(
    () => ({
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: '',
    }),
    [],
  );
  return (
    <AccountSelectorProviderMirror config={config} enabledNum={[0]}>
      <NotificationHandlerDiscoveryProvider>
        <BaseNotificationHandlerContainer />
      </NotificationHandlerDiscoveryProvider>
    </AccountSelectorProviderMirror>
  );
}
