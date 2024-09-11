import { useEffect } from 'react';

import { RootSiblingParent } from 'react-native-root-siblings';

import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import type { IJPushRemotePushMessageInfo } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { JotaiContextRootProvidersAutoMount } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';
import { Bootstrap } from '../Bootstrap';

import { AppStateLockContainer } from './AppStateLockContainer';
import { CloudBackupContainer } from './CloudBackupContainer';
import { ErrorToastContainer } from './ErrorToastContainer';
import { FlipperPluginsContainer } from './FlipperPluginsContainer';
import { ForceFirmwareUpdateContainer } from './ForceFirmwareUpdateContainer';
import { FullWindowOverlayContainer } from './FullWindowOverlayContainer';
import { GlobalWalletConnectModalContainer } from './GlobalWalletConnectModalContainer';
import { HardwareUiStateContainer } from './HardwareUiStateContainer';
import { KeyboardContainer } from './KeyboardContainer';
import { NavigationContainer } from './NavigationContainer';
import { PortalBodyContainer } from './PortalBodyContainer';
import { QrcodeDialogContainer } from './QrcodeDialogContainer';

const PageTrackerContainer = LazyLoad(
  () => import('./PageTrackerContainer'),
  100,
);

function GlobalRootAppNavigationUpdate() {
  const navigation = useAppNavigation();
  global.$rootAppNavigation = navigation;
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
        <KeyboardContainer />
        <NavigationContainer>
          <GlobalRootAppNavigationUpdate />
          <JotaiContextRootProvidersAutoMount />
          <Bootstrap />
          <QrcodeDialogContainer />
          <HardwareUiStateContainer />
          <CloudBackupContainer />
          <FullWindowOverlayContainer />
          <PortalBodyContainer />
          <PageTrackerContainer />
          <ErrorToastContainer />
          <ForceFirmwareUpdateContainer />
          {process.env.NODE_ENV !== 'production' ? (
            <>
              <FlipperPluginsContainer />
            </>
          ) : null}
          <ColdStartByNotification />
        </NavigationContainer>
        <GlobalWalletConnectModalContainer />
      </AppStateLockContainer>
    </RootSiblingParent>
  );
}
