import type { FC } from 'react';

import DiscoverDashboard from '../../Dashboard';
import { useWebTabsActions } from '../Context/contextWebTabs';

const WebHomeContainer: FC<{ alwaysOpenNewWindow?: boolean }> = ({
  alwaysOpenNewWindow,
}) => {
  const actions = useWebTabsActions();
  return (
    <DiscoverDashboard
      onItemSelect={(dapp) => {
        actions.openMatchDApp({
          id: dapp._id,
          dapp,
          isNewWindow: alwaysOpenNewWindow,
        });
      }}
    />
  );
};

WebHomeContainer.displayName = 'WebHomeContainer';
export default WebHomeContainer;
