import type { PropsWithChildren } from 'react';

export function NativeSheetRoot({
  children,
}: PropsWithChildren<{ blocked: boolean }>) {
  return <>{children}</>;
}
