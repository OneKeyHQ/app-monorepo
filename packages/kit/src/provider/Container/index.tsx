import { useEffect } from 'react';

import { RootSiblingParent } from 'react-native-root-siblings';

import {
  ETabletViewType,
  TabletModeViewContext,
  useIsNativeTablet,
} from '@onekeyhq/components';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import {
  isDualScreenDevice,
  isSpanning,
} from '@onekeyhq/shared/src/modules/DualScreenInfo/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletBackupPreCheckContainer } from '../../components/WalletBackup';
import useAppNavigation from '../../hooks/useAppNavigation';
import { JotaiContextRootProvidersAutoMount } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';
import { PrimeGlobalEffect } from '../../views/Prime/hooks/PrimeGlobalEffect';
import { Bootstrap } from '../Bootstrap';

import { AirGapQrcodeDialogContainer } from './AirGapQrcodeDialogContainer';
import { AppStateLockContainer } from './AppStateLockContainer';
import { CloudBackupContainer } from './CloudBackupContainer';
import { ColdStartByNotification } from './ColdStartByNotification';
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
import { TableSplitViewContainer } from './TableSplitViewContainer';
import { VerifyTxContainer } from './VerifyTxContainer';
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

function DetailRouter() {
  return (
    <NavigationContainer>
      <InAppNotification />
      <GlobalRootAppNavigationUpdate />
      <JotaiContextRootProvidersAutoMount />
      <Bootstrap />
      <AirGapQrcodeDialogContainer />
      <CreateAddressContainer />
      <PrevCheckBeforeSendingContainer />
      <WalletBackupPreCheckContainer />
      <VerifyTxContainer />
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
  );
}

function MainRouter() {
  return <NavigationContainer />;
}

const tabletMainViewContext = { viewType: ETabletViewType.MAIN };
const tabletDetailViewContext = { viewType: ETabletViewType.DETAIL };

const usePreCheckIsDualScreenDevice = platformEnv.isNativeAndroid
  ? () => {
      useEffect(() => {
        setTimeout(() => {
          void Promise.all([isDualScreenDevice(), isSpanning()]);
        });
      }, []);
    }
  : () => {};

export function Container() {
  usePreCheckIsDualScreenDevice();
  const isTablet = useIsNativeTablet();
  if (isTablet) {
    return (
      <RootSiblingParent>
        <AppStateLockContainer>
          <TableSplitViewContainer
            mainRouter={
              <TabletModeViewContext.Provider value={tabletMainViewContext}>
                <MainRouter />
              </TabletModeViewContext.Provider>
            }
            detailRouter={
              <TabletModeViewContext.Provider value={tabletDetailViewContext}>
                <DetailRouter />
              </TabletModeViewContext.Provider>
            }
          />
          <GlobalWalletConnectModalContainer />
        </AppStateLockContainer>
      </RootSiblingParent>
    );
  }
  return (
    <RootSiblingParent>
      <AppStateLockContainer>
        <DetailRouter />
        <GlobalWalletConnectModalContainer />
      </AppStateLockContainer>
    </RootSiblingParent>
  );
}
