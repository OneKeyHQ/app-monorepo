import { useEffect } from 'react';

import { RootSiblingParent } from 'react-native-root-siblings';

import { Dialog } from '@onekeyhq/components';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { navigateToNotificationDetailByLocalParams } from '@onekeyhq/shared/src/utils/notificationsUtils';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  ENotificationViewDialogActionType,
  type IJPushRemotePushMessageInfo,
  type INotificationViewDialogPayload,
} from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { WalletBackupPreCheckContainer } from '../../components/WalletBackup';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useVersionCompatible } from '../../hooks/useVersionCompatible';
import { JotaiContextRootProvidersAutoMount } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';
import { PrimeGlobalEffect } from '../../views/Prime/hooks/PrimeGlobalEffect';
import { Bootstrap } from '../Bootstrap';

import { AirGapQrcodeDialogContainer } from './AirGapQrcodeDialogContainer';
import { AppStateLockContainer } from './AppStateLockContainer';
import { CloudBackupContainer } from './CloudBackupContainer';
import { CreateAddressContainer } from './CreateAddressContainer';
import { DialogLoadingContainer } from './DialogLoadingContainer';
import { DiskFullWarningDialogContainer } from './DiskFullWarningDialogContainer';
import { ErrorToastContainer } from './ErrorToastContainer';
import { ForceFirmwareUpdateContainer } from './ForceFirmwareUpdateContainer';
import { FullWindowOverlayContainer } from './FullWindowOverlayContainer';
import { GlobalErrorHandlerContainer } from './GlobalErrorHandlerContainer';
import { GlobalWalletConnectModalContainer } from './GlobalWalletConnectModalContainer';
import { HardwareUiStateContainer } from './HardwareUiStateContainer';
import InAppNotification from './InAppNotification';
import { NavigationContainer } from './NavigationContainer';
import { PasswordVerifyPortalContainer } from './PasswordVerifyPortalContainer';
import { PortalBodyContainer } from './PortalBodyContainer';
import { PrevCheckBeforeSendingContainer } from './PrevCheckBeforeSendingContainer';
import { PrimeLoginContainerLazy } from './PrimeLoginContainer';
import { WebPerformanceMonitorContainer } from './WebPerformanceMonitor';

const PageTrackerContainer = LazyLoad(
  () => import('./PageTrackerContainer'),
  100,
);

function GlobalRootAppNavigationUpdate() {
  const navigation = useAppNavigation();
  appGlobals.$rootAppNavigation = navigation;
  return null;
}

export function ColdStartByNotification() {
  const { isVersionCompatible, showFallbackUpdateDialog } =
    useVersionCompatible();
  useEffect(() => {
    const options: IJPushRemotePushMessageInfo | null =
      ColdStartByNotification.launchNotification as IJPushRemotePushMessageInfo | null;
    if (options) {
      console.log(
        'coldStart ColdStartByNotification launchNotification',
        options,
      );
      options.msgId =
        options?.params?.msgId ||
        options?.msgId ||
        options?._j_msgid?.toString() ||
        '';
      console.log(
        'coldStart ColdStartByNotification launchNotification FIXED',
        options,
      );
      const title = options.aps?.alert?.title || '';
      const content = options.aps?.alert?.body || '';
      const icon = options?.image;
      const badge = options.aps?.badge?.toString() || '';

      void backgroundApiProxy.serviceNotification.handleColdStartByNotification(
        {
          notificationId: options.msgId,
          params: {
            notificationId: options.msgId,
            title,
            description: content,
            icon,
            remotePushMessageInfo: {
              pushSource: 'jpush',
              title,
              content,
              badge,
              extras: {
                ...options,
              },
            },
          },
        },
      );
    }
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
      onConfirm,
      ...rest
    }: INotificationViewDialogPayload) => {
      Dialog.show({
        ...rest,
        onConfirm: () => {
          const { actionType, payload } = onConfirm;
          switch (actionType) {
            case ENotificationViewDialogActionType.navigate:
              try {
                navigateToNotificationDetailByLocalParams({
                  payload: payload as any,
                  localParams: {},
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
  }, [isVersionCompatible, showFallbackUpdateDialog]);
  return null;
}
ColdStartByNotification.launchNotification = null;

export function Container() {
  return (
    <RootSiblingParent>
      <AppStateLockContainer>
        <NavigationContainer>
          <InAppNotification />
          <GlobalRootAppNavigationUpdate />
          <JotaiContextRootProvidersAutoMount />
          <Bootstrap />
          <AirGapQrcodeDialogContainer />
          <CreateAddressContainer />
          <PrevCheckBeforeSendingContainer />
          <WalletBackupPreCheckContainer />
          <HardwareUiStateContainer />
          <PrimeLoginContainerLazy />
          <DialogLoadingContainer />
          <DiskFullWarningDialogContainer />
          <CloudBackupContainer />
          <FullWindowOverlayContainer />
          <PortalBodyContainer />
          <PageTrackerContainer />
          <ErrorToastContainer />
          <GlobalErrorHandlerContainer />
          <ForceFirmwareUpdateContainer />
          <ColdStartByNotification />
          <PrimeGlobalEffect />
          <WebPerformanceMonitorContainer />
          <PasswordVerifyPortalContainer />
        </NavigationContainer>
        <GlobalWalletConnectModalContainer />
      </AppStateLockContainer>
    </RootSiblingParent>
  );
}
