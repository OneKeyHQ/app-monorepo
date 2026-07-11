import { codegenNativeComponent } from 'react-native';

import type { HostComponent, ViewProps } from 'react-native';

/* eslint-disable @typescript-eslint/naming-convention -- React Native's generated interface requires the NativeProps name. */
export interface NativeProps extends ViewProps {
  slotKey: string;
}

export default codegenNativeComponent<NativeProps>(
  'OneKeyHomeContainerSlot',
) as HostComponent<NativeProps>;
