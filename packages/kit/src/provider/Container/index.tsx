import { RootSiblingParent } from 'react-native-root-siblings';

import {
  ESplitViewType,
  SplitViewContext,
  isNativeTablet,
} from '@onekeyhq/components';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';

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
import { KeylessWalletContainerLazy } from './KeylessWalletContainer';
import { NavigationContainer } from './NavigationContainer';
import { PasswordVerifyPortalContainer } from './PasswordVerifyPortalContainer';
import { PrevCheckBeforeSendingContainer } from './PrevCheckBeforeSendingContainer';
import { PrimeLoginContainerLazy } from './PrimeLoginContainer';
import { RookieShareContainer } from './RookieShareContainer';
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
      <FullWindowOverlayContainer />
      <AirGapQrcodeDialogContainer />
      <CreateAddressContainer />
      <PrevCheckBeforeSendingContainer />
      <WalletBackupPreCheckContainer />
      <VerifyTxContainer />
      <HardwareUiStateContainer />
      <PrimeLoginContainerLazy />
      <KeylessWalletContainerLazy />
      <DialogLoadingContainer />
      <DiskFullWarningDialogContainer />
      <CloudBackupContainer />
      {/* <PortalBodyContainer /> */}
      <PageTrackerContainer />
      <ErrorToastContainer />
      <GlobalErrorHandlerContainer />
      <ForceFirmwareUpdateContainer />
      <ColdStartByNotification />
      <PrimeGlobalEffect />
      <WebPerformanceMonitorContainer />
      <PasswordVerifyPortalContainer />
      <RookieShareContainer />
    </NavigationContainer>
  );
}

function MainRouter() {
  return <NavigationContainer />;
}

const splitMainViewContext = { viewType: ESplitViewType.MAIN };
const splitSubViewContext = { viewType: ESplitViewType.SUB };

export function Container() {
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('Container render');
  }
  const isTablet = isNativeTablet();
  if (isTablet) {
    return (
      <RootSiblingParent>
        <AppStateLockContainer>
          <TableSplitViewContainer
            mainRouter={
              <SplitViewContext.Provider value={splitMainViewContext}>
                <MainRouter />
              </SplitViewContext.Provider>
            }
            detailRouter={
              <SplitViewContext.Provider value={splitSubViewContext}>
                <DetailRouter />
              </SplitViewContext.Provider>
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
