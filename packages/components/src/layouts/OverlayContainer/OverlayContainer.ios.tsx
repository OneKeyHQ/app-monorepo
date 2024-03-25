import { FullWindowOverlay } from 'react-native-screens';

import type { IOverlayContainerProps } from './type';

export function OverlayContainer({ children }: IOverlayContainerProps) {
  return <FullWindowOverlay>{children}</FullWindowOverlay>;
}
