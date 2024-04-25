import { Portal } from '../../hocs';

import type { IRenderToContainer } from './type';

export const renderToContainer: IRenderToContainer = (container, element) =>
  Portal.Render(container, element);
