import { View } from 'react-native';

import { useReplaySensitive } from '../../hooks/useReplaySensitive';

import { withReplayNoCaptureTestId } from './types';

import type { IReplaySensitiveViewProps } from './types';

// Native: besides the pause token, a real view whose testID carries the
// no-capture token, so the screenshot SDK masks the subtree even in a frame
// captured before the asynchronous native stop lands.
export function ReplaySensitiveView({
  children,
  active = true,
  tag = 'sensitiveView',
  testID,
  style,
}: IReplaySensitiveViewProps) {
  useReplaySensitive(active, tag);
  return (
    <View
      // Must stay a real native view; a flattened view has no testID.
      collapsable={false}
      testID={active ? withReplayNoCaptureTestId(testID) : testID}
      style={style}
    >
      {children}
    </View>
  );
}
