import { useEffect } from 'react';

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
import {
  ENotificationViewDialogActionType,
  type INotificationViewDialogPayload,
} from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useVersionCompatible } from '../../../hooks/useVersionCompatible';

import { NotificationHandlerContainer as BaseNotificationHandlerContainer } from './NotificationHandlerContainer';

export function NotificationHandlerContainer() {
  const { showFallbackUpdateDialog } = useVersionCompatible();

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
      localParams,
    }: {
      payload: INotificationViewDialogPayload;
      localParams: Record<string, string | undefined>;
    }) => {
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
    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowFallbackUpdateDialog,
        handleShowFallbackUpdateDialog,
      );
      appEventBus.off(
        EAppEventBusNames.ShowNotificationViewDialog,
        handleShowNotificationViewDialog,
      );
    };
  }, [showFallbackUpdateDialog]);
  return <BaseNotificationHandlerContainer />;
}
