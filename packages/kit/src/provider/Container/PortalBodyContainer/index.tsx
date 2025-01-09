import { memo } from 'react';

import { SidebarBanner } from './SideBanner';
import { WebPageTabBar } from './WebPageTabBar';

function BasicPortalBodyContainer() {
  return (
    <>
      <WebPageTabBar />
      <SidebarBanner />
    </>
  );
}

export const PortalBodyContainer = memo(BasicPortalBodyContainer);
