import { RootSiblingParent } from 'react-native-root-siblings';

import { JotaiContextRootProvidersAutoMount } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import { AppStateLockContainer } from './AppStateLockContainer';
import { FullWindowOverlayContainer } from './FullWindowOverlayContainer';
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
          <FullWindowOverlayContainer />
          <PortalBodyContainer />
        </NavigationContainer>
      </AppStateLockContainer>
    </RootSiblingParent>
  );
}
