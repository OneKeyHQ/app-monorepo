import { Portal } from '../../hocs';

import type { IRenderToContainer } from './type';

// The dialog hosts itself in its native overlay level. The portal is only the
// mount point; its name picks that level (`overlayLevelForContainer`).
export const renderToContainer: IRenderToContainer = (container, element) =>
  Portal.Render(container, element);
