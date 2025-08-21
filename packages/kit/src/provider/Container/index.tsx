import { useEffect } from 'react';

import { RootSiblingParent } from 'react-native-root-siblings';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import type { IJPushRemotePushMessageInfo } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { WalletBackupPreCheckContainer } from '../../components/WalletBackup';
import useAppNavigation from '../../hooks/useAppNavigation';
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
  }, []);
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
