import { FullWindowOverlay } from 'react-native-screens';

import type { IOverlayContainerProps } from './type';

function DevAppContainer({ children }: IOverlayContainerProps) {
  if (!__DEV__) {
    return <>{children}</>;
  }
  const AppContainer = require('react-native/Libraries/ReactNative/AppContainer');
  return <AppContainer internal_excludeLogBox>{children}</AppContainer>;
}

export function OverlayContainer({ children }: IOverlayContainerProps) {
  return (
    <FullWindowOverlay>
      <DevAppContainer>{children}</DevAppContainer>
    </FullWindowOverlay>
  );
}
