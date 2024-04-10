import { createPortal } from 'react-dom';

import { Portal } from '../../hocs';

import type { IRenderToContainer } from './type';

export const renderToContainer: IRenderToContainer = (container, element) => {
  const Component = () => createPortal(element, document.body);
  const renderElement = <Component />;
  return Portal.Render(container, renderElement);
};
