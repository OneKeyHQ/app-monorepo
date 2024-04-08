import { createPortal } from 'react-dom';

import { Portal } from '../../hocs';

import type { IRenderToRoot } from './type';

export const renderToRoot: IRenderToRoot = (element) => {
  const Component = () => createPortal(element, document.body);
  const renderElement = <Component />;
  return Portal.Render(
    Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
    renderElement,
  );
};
