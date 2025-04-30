import { Portal } from '../../hocs';
import { OverlayContainer } from '../../layouts/OverlayContainer';

import type { IRenderToContainer } from './type';

export const renderToContainer: IRenderToContainer = (
  container,
  element,
  isOverTopAllViews,
) =>
  Portal.Render(
    isOverTopAllViews ? Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL : container,
    <OverlayContainer>{element}</OverlayContainer>,
  );
