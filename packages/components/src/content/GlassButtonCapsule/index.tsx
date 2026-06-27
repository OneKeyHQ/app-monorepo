import type { PropsWithChildren } from 'react';

// Liquid Glass only exists on iOS 26+. On every other platform (Android, web,
// desktop, extension) render the button unchanged — the `.ios.tsx` variant is
// the only one that pulls in `expo-glass-effect` and adds the glass capsule, so
// this stays a zero-impact passthrough everywhere else.
export function GlassButtonCapsule({ children }: PropsWithChildren) {
  return <>{children}</>;
}
