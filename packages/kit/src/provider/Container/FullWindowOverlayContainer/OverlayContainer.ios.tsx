import { Fragment } from 'react';

import { FullWindowOverlay } from 'react-native-screens';

import type { IOverlayContainerProps } from './type';

export function OverlayContainer({ children }: IOverlayContainerProps) {
  const ChildrenContainer = __DEV__
    ? require('react-native/Libraries/ReactNative/AppContainer')
    : Fragment;
  return (
    <FullWindowOverlay>
      <ChildrenContainer>{children}</ChildrenContainer>
    </FullWindowOverlay>
  );
}
