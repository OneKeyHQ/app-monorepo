import type { PropsWithChildren } from 'react';

import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

import { PORT_HEIGHT, REPLICA_WIDTH } from './consts';

/**
 * Crops the replica to the port and dissolves its foot with a real mask:
 * the device fades to transparent, revealing whichever face is behind —
 * opaque paint in the light theme, the system glass in the dark one.
 */

// A mask reads alpha only, so the gradient's color is irrelevant. Explicit
// size, not an inset fill: Fabric lays out inset-only absolute children as
// 0x0.
const MASK_STYLE = {
  position: 'absolute' as const,
  left: 0,
  top: 0,
  width: REPLICA_WIDTH,
  height: PORT_HEIGHT,
};
const MASK = (
  <LinearGradient
    colors={['#000', '#000', 'transparent']}
    locations={[0, 0.58, 0.95]}
    style={MASK_STYLE}
  />
);

const PORT_STYLE = {
  alignSelf: 'center' as const,
  width: REPLICA_WIDTH,
  height: PORT_HEIGHT,
};

export function ReplicaPort({ children }: PropsWithChildren) {
  return (
    <MaskedView style={PORT_STYLE} maskElement={MASK}>
      {children}
    </MaskedView>
  );
}
