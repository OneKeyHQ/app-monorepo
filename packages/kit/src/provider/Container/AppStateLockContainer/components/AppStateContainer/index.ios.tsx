import type { PropsWithChildren } from 'react';

import { OverlayContainer, Portal } from '@onekeyhq/components';

export function AppStateContainer({ children }: PropsWithChildren) {
  return (
    <OverlayContainer>
      {children}
      {/* Host the lock screen's dialog portal inside the lock screen's own
          window overlay, the way web and Android already do. iOS stacks window
          overlays in the order they were added, and this one is added when the
          app locks — after the app's FullWindowOverlayContainer. A dialog that
          asked for `isOverTopAllViews` was therefore mounted into a window
          *below* this one and never became visible, so "Forgot passcode?" looked
          like it did nothing at all. Rendering into this container instead keeps
          the dialog in the top-most window and lets the dialog's portal manager
          tear it down again. (OK-62416) */}
      <Portal.Container
        name={Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY}
      />
    </OverlayContainer>
  );
}
