import { FC } from 'react';

import DiscoverHome from '../../Home';
import { useWebController } from '../Controller/useWebController';

const WebHomeContainer: FC<{ alwaysOpenNewWindow?: boolean }> = ({
  alwaysOpenNewWindow,
}) => {
  const { openMatchDApp } = useWebController();

  return (
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
};

WebHomeContainer.displayName = 'WebHomeContainer';
export default WebHomeContainer;
