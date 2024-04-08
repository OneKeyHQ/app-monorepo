import { Portal } from '../../hocs';
import { OverlayContainer } from '../../layouts/OverlayContainer';

import type { IRenderToRoot } from './type';

export const renderToRoot: IRenderToRoot = (element) =>
  Portal.Render(
    Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
    <OverlayContainer>{element}</OverlayContainer>,
  );
