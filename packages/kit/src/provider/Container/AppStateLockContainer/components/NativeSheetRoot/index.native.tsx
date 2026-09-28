import type { PropsWithChildren } from 'react';

import {
  NativeSheetHost,
  NativeSheetSecurityProvider,
} from '@onekeyfe/react-native-native-sheet';

export function NativeSheetRoot({
  blocked,
  children,
}: PropsWithChildren<{ blocked: boolean }>) {
  return (
    <NativeSheetSecurityProvider blocked={blocked}>
      {children}
      <NativeSheetHost />
    </NativeSheetSecurityProvider>
  );
}
