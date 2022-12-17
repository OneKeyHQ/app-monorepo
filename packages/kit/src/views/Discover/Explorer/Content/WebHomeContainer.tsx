import type { FC } from 'react';

import DiscoverHome from '../../Home';
import { openMatchDApp } from '../Controller/gotoSite';

const WebHomeContainer: FC<{ alwaysOpenNewWindow?: boolean }> = ({
  alwaysOpenNewWindow,
}) => (
  <DiscoverHome
    onItemSelect={(dapp) => {
      openMatchDApp({
        id: dapp._id,
        dapp,
        isNewWindow: alwaysOpenNewWindow,
      });
    }}
    onItemSelectHistory={(item) =>
      openMatchDApp({ ...item, isNewWindow: alwaysOpenNewWindow })
    }
  />
);

WebHomeContainer.displayName = 'WebHomeContainer';
export default WebHomeContainer;
