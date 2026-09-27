import type { PropsWithChildren } from 'react';

import { useOverlaySecurityBlocked } from './useOverlaySecurityBlocked';

export function NativeSheetRoot({
  blocked,
  children,
}: PropsWithChildren<{ blocked: boolean }>) {
  useOverlaySecurityBlocked(blocked);
  return <>{children}</>;
}
