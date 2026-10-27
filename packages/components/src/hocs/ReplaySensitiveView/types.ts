import type { ReactNode } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

// Token the native replay SDKs look for in a view's testID (iOS
// accessibilityIdentifier, Android view tag) to mask the whole subtree.
export const REPLAY_NO_CAPTURE_TOKEN = 'ph-no-capture';

export interface IReplaySensitiveViewProps {
  children?: ReactNode;
  // Holds the pause and the native mask only while true.
  active?: boolean;
  // Shows up in the gate's pause bookkeeping; not sent anywhere.
  tag?: string;
  // Native only. Kept as a prefix of the wrapper's testID.
  testID?: string;
  // Native only, for wrappers that must fill their parent.
  style?: StyleProp<ViewStyle>;
}

export function withReplayNoCaptureTestId(testID?: string): string {
  return testID
    ? `${testID}-${REPLAY_NO_CAPTURE_TOKEN}`
    : REPLAY_NO_CAPTURE_TOKEN;
}
