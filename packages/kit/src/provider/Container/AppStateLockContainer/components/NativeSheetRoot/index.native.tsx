import type { PropsWithChildren } from 'react';

import {
  NativeSheetHost,
  NativeSheetSecurityProvider,
} from '@onekeyfe/react-native-native-sheet';

import { useOverlaySecurityBlocked } from './useOverlaySecurityBlocked';

export function NativeSheetRoot({
  blocked,
  children,
}: PropsWithChildren<{ blocked: boolean }>) {
  useOverlaySecurityBlocked(blocked);
  return (
    <NativeSheetSecurityProvider blocked={blocked}>
      {children}
      <NativeSheetHost />
    </NativeSheetSecurityProvider>
  );
}
