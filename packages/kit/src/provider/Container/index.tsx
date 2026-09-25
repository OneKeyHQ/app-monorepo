import { useEffect } from 'react';

import { RootSiblingParent } from 'react-native-root-siblings';

import { ESplitViewType, SplitViewContext } from '@onekeyhq/components';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { setSplitViewLayoutDisabled } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';

import useAppNavigation from '../../hooks/useAppNavigation';
import { useShouldUseSplitView } from '../../hooks/useShouldUseSplitView';
import { JotaiContextRootProvidersAutoMount } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';
import { Bootstrap } from '../Bootstrap';

import { AirGapQrcodeDialogContainer } from './AirGapQrcodeDialogContainer';
import { AppStateLockContainer } from './AppStateLockContainer';
import { CloudBackupContainer } from './CloudBackupContainer';
import { ColdStartByNotification } from './ColdStartByNotification';
import { CreateAddressContainer } from './CreateAddressContainer';
import { DeviceStageContainerLazy } from './DeviceStageContainer/Lazy';
import { DialogLoadingContainer } from './DialogLoadingContainer';
import { DiskFullWarningDialogContainer } from './DiskFullWarningDialogContainer';
import { ErrorToastContainer } from './ErrorToastContainer';
import { ForceFirmwareUpdateContainer } from './ForceFirmwareUpdateContainer';
import { FullWindowOverlayContainer } from './FullWindowOverlayContainer';
import { GlobalErrorHandlerContainer } from './GlobalErrorHandlerContainer';
import { GlobalWalletConnectModalContainer } from './GlobalWalletConnectModalContainer';
import { HardwareUiStateContainerLazy } from './HardwareUiStateContainer/Lazy';
import InAppNotification from './InAppNotification';
import { KeylessWebAutoConnectHashCleanupContainer } from './KeylessWebAutoConnectHashCleanupContainer';
import { LinuxUdevGuideDialogContainer } from './LinuxUdevGuideDialogContainer/LinuxUdevGuideDialogContainer';
import { LocalDbDowngradeDialogContainer } from './LocalDbDowngradeDialogContainer';
import { LocalSecretEnvelopeErrorDialogContainer } from './LocalSecretEnvelopeErrorDialogContainer';
import { NavigationContainer } from './NavigationContainer';
import PageTrackerContainer from './PageTrackerContainer';
import { PasswordVerifyPortalContainer } from './PasswordVerifyPortalContainer';
import { PerpsUnifoldDepositTerminalDeliveryContainer } from './PerpsUnifoldDepositTerminalDeliveryContainer';
import { PrevCheckBeforeSendingContainer } from './PrevCheckBeforeSendingContainer';
import { PrimeGlobalEffectLazy } from './PrimeGlobalEffectLazy';
import { PrimeLoginContainerLazy } from './PrimeLoginContainer';
import { RookieShareContainerLazy } from './RookieShareContainer/Lazy';
import { SplitViewPerpTabSync } from './SplitViewPerpTabSync';
import { TableSplitViewContainer } from './TableSplitViewContainer';
import { ThirdPartyHardwareUiStateContainerLazy } from './ThirdPartyHardwareUiStateContainer/Lazy';
import { VerifyTxContainer } from './VerifyTxContainer';
import { WalletBackupPreCheckContainerLazy } from './WalletBackupPreCheckContainerLazy';
import { WalletConnectPayDialogContainer } from './WalletConnectPayDialogContainer';
import { WebPerformanceMonitorContainer } from './WebPerformanceMonitor';

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
      <WalletBackupPreCheckContainerLazy />
      <VerifyTxContainer />
      <HardwareUiStateContainerLazy />
      <ThirdPartyHardwareUiStateContainerLazy />
      <DeviceStageContainerLazy />
      <PrimeLoginContainerLazy />
      <KeylessWebAutoConnectHashCleanupContainer />
      <DialogLoadingContainer />
      <DiskFullWarningDialogContainer />
      <LinuxUdevGuideDialogContainer />
      <LocalDbDowngradeDialogContainer />
      <LocalSecretEnvelopeErrorDialogContainer />
      <CloudBackupContainer />

      {/* <PortalBodyContainer /> */}
      <PageTrackerContainer />
      <ErrorToastContainer />
      <PerpsUnifoldDepositTerminalDeliveryContainer />
      <GlobalErrorHandlerContainer />
      <ForceFirmwareUpdateContainer />
      <ColdStartByNotification />
      <PrimeGlobalEffectLazy />
      <WebPerformanceMonitorContainer />
      <PasswordVerifyPortalContainer />
      <RookieShareContainerLazy />
      <WalletConnectPayDialogContainer />
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
  const shouldUseSplitView = useShouldUseSplitView();

  // Tell the dual-screen width helper whether the app is rendering as a single
  // logical pane. Without this, a foldable Android in spanning mode would
  // always halve the tab-container width even after the user disabled the
  // split-view setting — leaving Wallet/Home content stuck on the left half.
  useEffect(() => {
    setSplitViewLayoutDisabled(!shouldUseSplitView);
  }, [shouldUseSplitView]);

  if (shouldUseSplitView) {
    return (
      <RootSiblingParent>
        <AppStateLockContainer>
          {/* Page.Every must register before routers render their active page. */}
          <GlobalWalletConnectModalContainer />
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
          <SplitViewPerpTabSync />
        </AppStateLockContainer>
      </RootSiblingParent>
    );
  }
  return (
    <RootSiblingParent>
      <AppStateLockContainer>
        {/* Page.Every must register before routers render their active page. */}
        <GlobalWalletConnectModalContainer />
        <DetailRouter />
      </AppStateLockContainer>
    </RootSiblingParent>
  );
}
