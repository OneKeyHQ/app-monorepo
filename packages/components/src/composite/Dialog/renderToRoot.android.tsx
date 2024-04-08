import { Portal } from '../../hocs';

import type { IRenderToRoot } from './type';

export const renderToRoot: IRenderToRoot = (element) =>
  Portal.Render(Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY, element);
