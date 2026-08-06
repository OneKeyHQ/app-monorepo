import type { PropsWithChildren } from 'react';

import { Stack } from '../../primitives';

import { PORT_HEIGHT, REPLICA_WIDTH } from './consts';

import type { ViewStyle } from 'react-native';

/**
 * Web counterpart of the native masked port: a CSS mask fades the replica's
 * foot to transparent over whatever face is behind it.
 */

// Web-only CSS properties, outside RN's style typing — hence the cast.
const MASK_STYLE = {
  WebkitMaskImage: 'linear-gradient(to bottom, #000 58%, transparent 95%)',
  maskImage: 'linear-gradient(to bottom, #000 58%, transparent 95%)',
} as unknown as ViewStyle;

export function ReplicaPort({ children }: PropsWithChildren) {
  return (
    <Stack
      alignSelf="center"
      width={REPLICA_WIDTH}
      height={PORT_HEIGHT}
      overflow="hidden"
      style={MASK_STYLE}
    >
      {children}
    </Stack>
  );
}
