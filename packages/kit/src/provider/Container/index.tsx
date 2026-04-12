import { RootSiblingParent } from 'react-native-root-siblings';

import {
  ESplitViewType,
  SplitViewContext,
  isNativeTablet,
} from '@onekeyhq/components';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';

// [ONBOARDING-DEV] import { WalletBackupPreCheckContainer } from '../../components/WalletBackup';
import useAppNavigation from '../../hooks/useAppNavigation';
import { JotaiContextRootProvidersAutoMount } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';
// [ONBOARDING-DEV] import { PrimeGlobalEffect } from '../../views/Prime/hooks/PrimeGlobalEffect';
import { Bootstrap } from '../Bootstrap';

import { AirGapQrcodeDialogContainer } from './AirGapQrcodeDialogContainer';
import { AppStateLockContainer } from './AppStateLockContainer';
import { CloudBackupContainer } from './CloudBackupContainer';
// [ONBOARDING-DEV] import { ColdStartByNotification } from './ColdStartByNotification';
import { CreateAddressContainer } from './CreateAddressContainer';
import { DialogLoadingContainer } from './DialogLoadingContainer';
// [ONBOARDING-DEV] import { DiskFullWarningDialogContainer } from './DiskFullWarningDialogContainer';
import { ErrorToastContainer } from './ErrorToastContainer';
// [ONBOARDING-DEV] import { ForceFirmwareUpdateContainer } from './ForceFirmwareUpdateContainer';
import { FullWindowOverlayContainer } from './FullWindowOverlayContainer';
import { GlobalErrorHandlerContainer } from './GlobalErrorHandlerContainer';
import { GlobalWalletConnectModalContainer } from './GlobalWalletConnectModalContainer';
import { HardwareUiStateContainer } from './HardwareUiStateContainer';
// [ONBOARDING-DEV] import InAppNotification from './InAppNotification';
import { KeylessWalletContainerLazy } from './KeylessWalletContainer';
import { KeylessWebAutoConnectHashCleanupContainer } from './KeylessWebAutoConnectHashCleanupContainer';
import { NavigationContainer } from './NavigationContainer';
import { PasswordVerifyPortalContainer } from './PasswordVerifyPortalContainer';
// [ONBOARDING-DEV] import { PrevCheckBeforeSendingContainer } from './PrevCheckBeforeSendingContainer';
// [ONBOARDING-DEV] import { PrimeLoginContainerLazy } from './PrimeLoginContainer';
// [ONBOARDING-DEV] import { RookieShareContainer } from './RookieShareContainer';
import { TableSplitViewContainer } from './TableSplitViewContainer';
// [ONBOARDING-DEV] import { VerifyTxContainer } from './VerifyTxContainer';
// [ONBOARDING-DEV] import { WebPerformanceMonitorContainer } from './WebPerformanceMonitor';

// [ONBOARDING-DEV] const PageTrackerContainer = LazyLoad(
//   () => import('./PageTrackerContainer'),
//   100,
// );

function GlobalRootAppNavigationUpdate() {
  const navigation = useAppNavigation();
  appGlobals.$rootAppNavigation = navigation;
  return null;
}

function DetailRouter() {
  return (
    <NavigationContainer>
      {/* [ONBOARDING-DEV] <InAppNotification /> */}
      <GlobalRootAppNavigationUpdate />
      <JotaiContextRootProvidersAutoMount />
      <Bootstrap />
      <FullWindowOverlayContainer />
      <AirGapQrcodeDialogContainer />
      <CreateAddressContainer />
      {/* [ONBOARDING-DEV] <PrevCheckBeforeSendingContainer /> */}
      {/* [ONBOARDING-DEV] <WalletBackupPreCheckContainer /> */}
      {/* [ONBOARDING-DEV] <VerifyTxContainer /> */}
      <HardwareUiStateContainer />
      {/* [ONBOARDING-DEV] <PrimeLoginContainerLazy /> */}
      <KeylessWalletContainerLazy />
      <KeylessWebAutoConnectHashCleanupContainer />
      <DialogLoadingContainer />
      {/* [ONBOARDING-DEV] <DiskFullWarningDialogContainer /> */}
      <CloudBackupContainer />

      {/* <PortalBodyContainer /> */}
      {/* [ONBOARDING-DEV] <PageTrackerContainer /> */}
      <ErrorToastContainer />
      <GlobalErrorHandlerContainer />
      {/* [ONBOARDING-DEV] <ForceFirmwareUpdateContainer /> */}
      {/* [ONBOARDING-DEV] <ColdStartByNotification /> */}
      {/* [ONBOARDING-DEV] <PrimeGlobalEffect /> */}
      {/* [ONBOARDING-DEV] <WebPerformanceMonitorContainer /> */}
      <PasswordVerifyPortalContainer />
      {/* [ONBOARDING-DEV] <RookieShareContainer /> */}
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
