import type { CSSProperties, PropsWithChildren } from 'react';

import { createPortal } from 'react-dom';

import { Portal } from '@onekeyhq/components';

// `document.body` is a flex container, so this portal root would otherwise
// collapse to a zero-width flex item pushed beside the app root. The lock
// screen itself survives that (it is `position: absolute` and resolves against
// the initial containing block), but anything portalled into
// APP_STATE_LOCK_CONTAINER_OVERLAY resolves its static position against this
// node — a sheet-form dialog then landed one viewport to the right, off screen.
// Fill the viewport so this node is the containing block its children expect.
// `absolute`, not `fixed`: it keeps `z-index: auto` and therefore creates no
// stacking context, so the lock screen's own z-index still competes with the
// rest of `document.body` exactly as before. (OK-62416)
const portalRootStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

export function AppStateContainer({ children }: PropsWithChildren) {
  return createPortal(
    <div style={portalRootStyle}>
      {children}
      <Portal.Container
        name={Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY}
      />
    </div>,
    document.body,
  );
}
