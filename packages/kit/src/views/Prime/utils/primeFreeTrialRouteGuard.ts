import { rootNavigationRef } from '@onekeyhq/components';

// Snapshot of the focused route when a free-trial check starts. The returned
// check turns false once the user is elsewhere: back, close (already during
// the close animation) or another page pushed. Dialogs and popovers, such as
// the login dialog, keep the route. Without a navigation it always passes.
export function captureFreeTrialRoute(): () => boolean {
  const key = rootNavigationRef.current?.getCurrentRoute?.()?.key;
  return () =>
    !key || rootNavigationRef.current?.getCurrentRoute?.()?.key === key;
}
