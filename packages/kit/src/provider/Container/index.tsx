import { RootSiblingParent } from 'react-native-root-siblings';

import { FullWindowOverlayContainer } from './FullWindowOverlayContainer';
import { NavigationContainer } from './NavigationContainer';

export function Container() {
  return (
    <RootSiblingParent>
      <NavigationContainer />
      <FullWindowOverlayContainer />
    </RootSiblingParent>
  );
}
