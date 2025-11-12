import { memo } from 'react';

import { BottomMenu } from './BottomMenu';
import { WebPageTabBar } from './WebPageTabBar';

function BasicPortalBodyContainer() {
  return (
    <>
      <WebPageTabBar />
      <BottomMenu />
    </>
  );
}

export const PortalBodyContainer = memo(BasicPortalBodyContainer);
