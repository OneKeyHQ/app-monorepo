import type { PropsWithChildren } from 'react';

import { Stack } from '../../primitives';

import { PORT_HEIGHT, REPLICA_WIDTH } from './consts';

import type { ViewStyle } from 'react-native';

/**
 * Web counterpart of the native masked port: a CSS mask fades the replica's
 * foot to transparent over whatever face is behind it. Fixed full-port
 * geometry — how much of it is on show is the stage's business, since it
 * animates the window this sits in.
 */

// Web-only CSS properties, outside RN's style typing — hence the cast. The
// curve is the flow spec's stage fog (its mask rectangle fades from the
// very top): full at the top edge, half at 49% of the device, gone at 74%.
// Percentages, matching the native sibling's `locations`, and resolved
// against the explicit port height below.
const MASK_GRADIENT =
  'linear-gradient(to bottom, #000 0, rgba(0,0,0,0.5) 58%, transparent 87%)';
const MASK_STYLE = {
  WebkitMaskImage: MASK_GRADIENT,
  maskImage: MASK_GRADIENT,
} as unknown as ViewStyle;

export function ReplicaPort({ children }: PropsWithChildren) {
  return (
    <Stack
      width={REPLICA_WIDTH}
      height={PORT_HEIGHT}
      overflow="hidden"
      style={MASK_STYLE}
    >
      {children}
    </Stack>
  );
}
