import { codegenNativeComponent } from 'react-native';

import type { HostComponent, ViewProps } from 'react-native';

export interface INativeOverlayPageHostNativeProps extends ViewProps {
  hostKey: string;
  /** Owners whose entries are hidden, newline separated. */
  suspendedOwners?: string;
}

export default codegenNativeComponent<INativeOverlayPageHostNativeProps>(
  'RNCNativeOverlayPageHost',
) as HostComponent<INativeOverlayPageHostNativeProps>;
