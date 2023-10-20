import type { FC } from 'react';

import { openMatchDApp } from '../Controller/gotoSite';
import DiscoverDashboard from '../Dashboard';

const WebHomeContainer: FC<{ alwaysOpenNewWindow?: boolean }> = ({
  alwaysOpenNewWindow,
}) => (
  <DiscoverDashboard
    onItemSelect={(dapp) => {
      openMatchDApp({
        id: dapp._id,
        dapp,
        isNewWindow: alwaysOpenNewWindow,
      });
    }}
  />
);

WebHomeContainer.displayName = 'WebHomeContainer';
export default WebHomeContainer;
