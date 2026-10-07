import type { PropsWithChildren } from 'react';

import type { ColorValue } from 'react-native';

export interface INativeSheetPresentationProps extends PropsWithChildren {
  open: boolean;
  height?: number;
  maxHeight?: number;
  onOpenChange?: (open: boolean) => void;
  onAnimationComplete?: (info: { open: boolean }) => void;
  dismissOnOverlayPress?: boolean;
  dismissOnSnapToBottom?: boolean;
  disableDrag?: boolean;
  dismissOnBackPress?: boolean;
  showHandle?: boolean;
  cornerRadius?: number;
  dimAmount?: number;
  backgroundColor?: ColorValue;
  testID?: string;
}
