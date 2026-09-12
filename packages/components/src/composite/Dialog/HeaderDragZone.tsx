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

// Web: callers disable the header drag in the browser, and the gesture
// handler has no web build to load here, so the zone is a plain container.
// The native file carries the pan.
export function HeaderDragZone({ minHeight, children }: IHeaderDragZoneProps) {
  return <Stack minHeight={minHeight}>{children}</Stack>;
}
