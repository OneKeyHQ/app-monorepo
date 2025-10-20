import { memo } from 'react';

import { WebPageTabBar } from './WebPageTabBar';

function BasicPortalBodyContainer() {
  return <WebPageTabBar />;
}

export const PortalBodyContainer = memo(BasicPortalBodyContainer);
