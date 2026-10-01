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

/**
 * Sheet options a Popover / ActionList / Select / Dialog passes to its native
 * overlay sheet.
 */
export interface ISheetOptions {
  /** `fit` (default) sizes the sheet to its content. */
  snapPointsMode?: 'fit' | 'percent';
  /** `percent` mode: the sheet height as a percentage of the screen. */
  snapPoints?: number[];
  disableDrag?: boolean;
  dismissOnSnapToBottom?: boolean;
  dismissOnOverlayPress?: boolean;
  onAnimationComplete?: (info: { open: boolean }) => void;
}
