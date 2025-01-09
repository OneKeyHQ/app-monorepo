import { Portal } from '../../hocs';
import { OverlayContainer } from '../../layouts/OverlayContainer';

import type { IRenderToContainer } from './type';

export const renderToContainer: IRenderToContainer = (_, element) =>
  Portal.Render(
    Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
    <OverlayContainer>{element}</OverlayContainer>,
  );
