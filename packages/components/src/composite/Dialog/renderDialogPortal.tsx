import type { ReactElement } from 'react';

import { Portal } from '../../hocs';
import { OverlayContainer } from '../../layouts/OverlayContainer';

import { renderToContainer } from './renderToContainer';

import type { EPortalContainerConstantName, IPortalManager } from '../../hocs';

/**
 * Decides where a dialog mounts.
 *
 * `isOverTopAllViews` used to be read only by `renderToContainer`, so a dialog
 * that asked for it without naming a container silently got the default portal
 * instead — the flag did nothing. On iOS that portal lives in the
 * `FullWindowOverlay` created at app start, which sits below any native modal
 * page presented later, so such a dialog could end up underneath the page that
 * opened it. Wrapping in `OverlayContainer` gives it a window of its own, added
 * last and therefore on top; off iOS `OverlayContainer` renders its children
 * unchanged, so only iOS stacking is affected. (OK-62416)
 */
export function renderDialogPortal({
  element,
  portalContainer,
  isOverTopAllViews,
}: {
  element: ReactElement;
  portalContainer?: EPortalContainerConstantName;
  isOverTopAllViews?: boolean;
}): IPortalManager {
  if (portalContainer) {
    return renderToContainer(portalContainer, element, isOverTopAllViews);
  }
  return Portal.Render(
    Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
    isOverTopAllViews ? (
      <OverlayContainer>{element}</OverlayContainer>
    ) : (
      element
    ),
  );
}
