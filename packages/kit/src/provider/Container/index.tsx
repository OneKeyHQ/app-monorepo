import { RootSiblingParent } from 'react-native-root-siblings';

import { AppStateLockContainer } from './AppStateLockContainer';
import { FullWindowOverlayContainer } from './FullWindowOverlayContainer';
import { KeyboardContainer } from './KeyboardContainer';
import { NavigationContainer } from './NavigationContainer';

export function Container() {
  return (
    <RootSiblingParent>
      <AppStateLockContainer>
        <KeyboardContainer />
        <NavigationContainer />
      </AppStateLockContainer>
      <FullWindowOverlayContainer />
    </RootSiblingParent>
  );
}
