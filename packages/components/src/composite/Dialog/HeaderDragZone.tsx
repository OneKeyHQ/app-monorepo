import { Stack } from '../../primitives';

import type { SharedValue } from 'react-native-reanimated';

export type IHeaderDragZoneProps = {
  /** vertical offset the sheet body follows while the header is dragged */
  dragY: SharedValue<number>;
  /** called once a completed downward pull passes the dismiss thresholds */
  onDismiss: () => void;
  /** keeps the zone tall enough to grab when the dialog renders no title */
  minHeight?: number;
  children: React.ReactNode;
};

// Web/desktop/ext: every caller passes disableDrag in the browser, so
// isHeaderDragOnly is never true here and this zone is a plain container.
// Keeping the pan in the native file also keeps the gesture-handler barrel
// out of the web bundle, and out of Dialog.focus.test.tsx, which runs jsdom
// with node export conditions.
export function HeaderDragZone({ minHeight, children }: IHeaderDragZoneProps) {
  return <Stack minHeight={minHeight}>{children}</Stack>;
}
