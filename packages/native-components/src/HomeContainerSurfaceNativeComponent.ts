import { codegenNativeComponent } from 'react-native';

import type { HostComponent, ViewProps } from 'react-native';

/* eslint-disable @typescript-eslint/naming-convention -- React Native's generated interface requires the NativeProps name. */
/* eslint-disable @typescript-eslint/no-empty-object-type -- The surface only needs inherited Fabric view props. */
export interface NativeProps extends ViewProps {}

export default codegenNativeComponent<NativeProps>(
  'OneKeyHomeContainerSurface',
) as HostComponent<NativeProps>;
