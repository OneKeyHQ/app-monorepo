import { codegenNativeComponent } from 'react-native';

import type { HostComponent, ViewProps } from 'react-native';

// eslint-disable-next-line @typescript-eslint/naming-convention
export interface NativeProps extends ViewProps {
  ownerScopeKey: string;
  ownerSessionId: string;
}

export default codegenNativeComponent<NativeProps>(
  'OneKeyHomeContainerVisualSurface',
) as HostComponent<NativeProps>;
