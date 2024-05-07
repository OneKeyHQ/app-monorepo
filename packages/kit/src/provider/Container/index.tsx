import { RootSiblingParent } from 'react-native-root-siblings';

import { JotaiContextRootProvidersAutoMount } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';

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

export function Container() {
  return (
    <RootSiblingParent>
      <AppStateLockContainer>
        <KeyboardContainer />
        <NavigationContainer>
          <JotaiContextRootProvidersAutoMount />
          <HardwareUiStateContainer />
          <CloudBackupContainer />
          <FullWindowOverlayContainer />
          <PortalBodyContainer />
          <ErrorToastContainer />
          <ForceFirmwareUpdateContainer />
          {process.env.NODE_ENV !== 'production' ? (
            <>
              <FlipperPluginsContainer />
            </>
          ) : null}
        </NavigationContainer>
        <GlobalWalletConnectModalContainer />
      </AppStateLockContainer>
    </RootSiblingParent>
  );
}
