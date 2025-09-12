import { Portal } from '../../hocs';
import { OverlayContainer } from '../../layouts/OverlayContainer';

import type { IRenderToContainer } from './type';

export const renderToContainer: IRenderToContainer = (
  container,
  element,
  isOverTopAllViews,
) => {
  if (isOverTopAllViews) {
    Portal.Render(
      Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
      <OverlayContainer>{element}</OverlayContainer>,
    );
  }
  return Portal.Render(container, element);
};
