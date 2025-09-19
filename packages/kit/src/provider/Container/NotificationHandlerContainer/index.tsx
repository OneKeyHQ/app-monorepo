import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Dialog } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
import { useVersionCompatible } from '../../../hooks/useVersionCompatible';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import { useInitialNotification } from './hooks';

function BaseNotificationHandlerContainer() {
  const { showFallbackUpdateDialog } = useVersionCompatible();

  const { activeAccount } = useActiveAccount({ num: 0 });
  const activeAccountRef = useRef(activeAccount);
  activeAccountRef.current = activeAccount;

  const getLocalParams = useCallback(() => {
    return {
      accountId: activeAccountRef.current?.account?.id,
      indexedAccountId: activeAccountRef.current?.indexedAccount?.id,
      networkId: activeAccountRef.current?.network?.id,
      walletId: activeAccountRef.current?.wallet?.id,
      accountName: activeAccountRef.current?.account?.name,
      deriveType: activeAccountRef.current?.deriveType,
      avatarUrl: activeAccountRef.current?.wallet?.avatar,
    };
  }, [activeAccountRef]);

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
              } catch (error) {
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
    const handleShowNotificationPageNavigation = ({
      payload: payloadObj,
    }: {
      payload: {
        screen: string;
        params: Record<string, any>;
      };
    }) => {
      const localParams = getLocalParams();
      navigateToNotificationDetailByLocalParams({
        payload: payloadObj,
        localParams,
        getEarnAccount: (props) =>
          backgroundApiProxy.serviceStaking.getEarnAccount(props),
      }).catch(() => {
        showFallbackUpdateDialog(null);
      });
    };
    appEventBus.on(
      EAppEventBusNames.ShowNotificationPageNavigation,
      handleShowNotificationPageNavigation,
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
    };
  }, [getLocalParams, showFallbackUpdateDialog]);
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
      <BaseNotificationHandlerContainer />
    </AccountSelectorProviderMirror>
  );
}
