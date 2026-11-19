import type { PropsWithChildren } from 'react';

import { AppStateLockContainer } from './AppStateLockContainer';
import { IntercomLockGuard } from './IntercomNotificationContainer/IntercomLockGuard';

// Guards that must run while the lock container defers its children.
export function AppLockBoundary({ children }: PropsWithChildren) {
  return (
    <>
      <IntercomLockGuard />
      <AppStateLockContainer>{children}</AppStateLockContainer>
    </>
  );
}
