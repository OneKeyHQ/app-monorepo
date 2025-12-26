import { RootSiblingParent } from 'react-native-root-siblings';

import {
  ETabletViewType,
  TabletModeViewContext,
  useIsNativeTablet,
} from '@onekeyhq/components';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

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
      <KeylessWalletContainerLazy />
      <DialogLoadingContainer />
      <DiskFullWarningDialogContainer />
      <CloudBackupContainer />
      <FullWindowOverlayContainer />
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

export function Container() {
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
