import type { PropsWithChildren } from 'react';

import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

import { PORT_HEIGHT, REPLICA_WIDTH } from './consts';

/**
 * Crops the replica to the port and dissolves its foot with a real mask:
 * the device fades to transparent, revealing whichever face is behind —
 * opaque paint in the light theme, the system glass in the dark one.
 *
 * Fixed full-port geometry. How much of it is on show is the stage's
 * business — it animates the window this sits in — so the fade stays put
 * while the arrangement moves; the compact miniature lives in the fog's
 * still-strong upper reach, only its foot dipping into the fade.
 */

// A mask reads alpha only, so the gradient's color is irrelevant. Explicit
// size, not an inset fill: Fabric lays out inset-only absolute children as
// 0x0. The curve is the flow spec's stage fog (its mask rectangle fades
// from the very top): full at the top edge, half at 49% of the device,
// gone at 74% — here in port coordinates, 0 / 0.58 / 0.87 of 376.
const MASK_STYLE = {
  position: 'absolute' as const,
  left: 0,
  top: 0,
  width: REPLICA_WIDTH,
  height: PORT_HEIGHT,
};
const MASK = (
  <LinearGradient
    colors={['#000', 'rgba(0,0,0,0.5)', 'transparent']}
    locations={[0, 0.58, 0.87]}
    style={MASK_STYLE}
  />
);

const PORT_STYLE = {
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
