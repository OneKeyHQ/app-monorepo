import { FullWindowOverlay } from 'react-native-screens';

import type { IOverlayContainerProps } from './type';

export function OverlayContainer({
  children,
  bringToFrontToken,
}: IOverlayContainerProps) {
  return (
    <FullWindowOverlay bringToFrontToken={bringToFrontToken}>
      {children}
    </FullWindowOverlay>
  );
}
