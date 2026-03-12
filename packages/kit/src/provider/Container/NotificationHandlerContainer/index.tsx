import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Dialog } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { navigateToNotificationDetailByLocalParams } from '@onekeyhq/shared/src/utils/notificationsUtils';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  ENotificationViewDialogActionType,
  type INotificationViewDialogPayload,
} from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useReferFriends } from '../../../hooks/useReferFriends';
import { useVersionCompatible } from '../../../hooks/useVersionCompatible';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useBrowserAction } from '../../../states/jotai/contexts/discovery';
import { DiscoveryBrowserProviderMirror } from '../../../views/Discovery/components/DiscoveryBrowserProviderMirror';

import { executeNotificationCommand } from './commandRegistry';
import { useInitialNotification } from './hooks';

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

  const browserAction = useBrowserAction().current;

  useEffect(() => {
    const handleShowFallbackUpdateDialog = ({
      version,
    }: {
      version: string | null | undefined;
    }) => {
      showFallbackUpdateDialog(version);
    };
    appEventBus.on(
      EAppEventBusNames.ShowFallbackUpdateDialog,
      handleShowFallbackUpdateDialog,
    );
    const handleShowNotificationViewDialog = ({
      payload: payloadObj,
    }: {
      payload: INotificationViewDialogPayload;
    }) => {
      const localParams = getLocalParams();
      const { onConfirm, ...rest } = payloadObj;
      Dialog.show({
        ...rest,
        onConfirm: async () => {
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
                showFallbackUpdateDialog(null);
              }
              break;
            case ENotificationViewDialogActionType.openInApp:
              openUrlInApp(payload as string);
              break;
            case ENotificationViewDialogActionType.openInBrowser:
              openUrlExternal(payload as string);
              break;
            default:
              break;
          }
        },
      });
    };
    appEventBus.on(
      EAppEventBusNames.ShowNotificationViewDialog,
      handleShowNotificationViewDialog,
    );
    const handleShowNotificationPageNavigation = async ({
      payload: payloadObj,
      extras,
    }: {
      payload: {
        screen: string;
        params: Record<string, any>;
      };
      extras?: {
        params?: {
          coin?: string;
          type?: string;
          [key: string]: any;
        };
        [key: string]: any;
      };
    }) => {
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
          await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
            coin: perpToken,
          });
        } catch (error) {
          console.error('Failed to change perps active asset:', error);
        }
      }

      navigateToNotificationDetailByLocalParams({
        payload: payloadObj,
        localParams,
        getEarnAccount: (props) =>
          backgroundApiProxy.serviceStaking.getEarnAccount(props),
      }).catch((error) => {
        console.error(error);
        showFallbackUpdateDialog(null);
      });
    };
    const handleShowNotificationDappNavigation = (url: string) => {
      if (platformEnv.isNative || platformEnv.isDesktop) {
        browserAction.handleOpenWebSite({
          webSite: {
            url,
            title: '',
            logo: undefined,
            sortIndex: undefined,
          },
          navigation,
          useCurrentWindow: false,
          tabId: '',
        });
      } else {
        openUrlExternal(url);
      }
    };
    appEventBus.on(
      EAppEventBusNames.ShowNotificationPageNavigation,
      handleShowNotificationPageNavigation,
    );
    appEventBus.on(
      EAppEventBusNames.ShowNotificationInDappPage,
      handleShowNotificationDappNavigation,
    );

    const handleExecuteCommand = ({
      action,
      data,
    }: {
      action: string;
      data?: Record<string, unknown>;
    }) => {
      const context = { toInviteRewardPage, openHardwareSalesOrderDetail };
      const success = executeNotificationCommand(action, context, data);
      if (!success) {
        showFallbackUpdateDialog(null);
      }
    };
    appEventBus.on(
      EAppEventBusNames.ExecuteNotificationCommand,
      handleExecuteCommand,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowFallbackUpdateDialog,
        handleShowFallbackUpdateDialog,
      );
      appEventBus.off(
        EAppEventBusNames.ShowNotificationViewDialog,
        handleShowNotificationViewDialog,
      );
      appEventBus.off(
        EAppEventBusNames.ShowNotificationPageNavigation,
        handleShowNotificationPageNavigation,
      );
      appEventBus.off(
        EAppEventBusNames.ShowNotificationInDappPage,
        handleShowNotificationDappNavigation,
      );
      appEventBus.off(
        EAppEventBusNames.ExecuteNotificationCommand,
        handleExecuteCommand,
      );
    };
  }, [
    browserAction,
    getLocalParams,
    navigation,
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
      <DiscoveryBrowserProviderMirror>
        <BaseNotificationHandlerContainer />
      </DiscoveryBrowserProviderMirror>
    </AccountSelectorProviderMirror>
  );
}
