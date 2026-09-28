import { StyleSheet } from 'react-native';

import NativeOverlayPageHost from './NativeOverlayPageHostNativeComponent';
import { useSuspendedPageOwners } from './useSuspendedPageOwners';

/**
 * Renders page-scope overlays of one root route. Place it as the last child
 * of the root-route screen, after its navigator, so page overlays cover the
 * native header and tab bar of every page in that route.
 */
export function OverlayPageHost({ hostKey }: { hostKey: string }) {
  const suspendedOwners = useSuspendedPageOwners(hostKey);
  return (
    <NativeOverlayPageHost
      hostKey={hostKey}
      suspendedOwners={suspendedOwners.join('\n')}
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
    />
  );
}
