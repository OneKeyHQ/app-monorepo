import { RootSiblingParent } from 'react-native-root-siblings';

import { AppStateLockContainer } from './AppStateLockContainer';
import { FullWindowOverlayContainer } from './FullWindowOverlayContainer';
import { KeyboardContainer } from './KeyboardContainer';
import { NavigationContainer } from './NavigationContainer';
import { PortalBodyContainer } from './PortalBodyContainer';

export function Container() {
  return (
    <RootSiblingParent>
      <AppStateLockContainer>
        <KeyboardContainer />
        <NavigationContainer>
          <FullWindowOverlayContainer />
          <PortalBodyContainer />
        </NavigationContainer>
      </AppStateLockContainer>
    </RootSiblingParent>
  );
}
