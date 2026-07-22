import { codegenNativeComponent } from 'react-native';

import type { HostComponent, ViewProps } from 'react-native';
import type { Double } from 'react-native/Libraries/Types/CodegenTypes';

/* eslint-disable @typescript-eslint/naming-convention -- React Native's generated interface requires the NativeProps name. */
export interface NativeProps extends ViewProps {
  ownerScopeKey: string;
  ownerSessionId: string;
  producedByStoreCommitId: Double;
  slotKey: string;
  slotRevision: Double;
}

export default codegenNativeComponent<NativeProps>(
  'OneKeyHomeContainerSlot',
) as HostComponent<NativeProps>;
