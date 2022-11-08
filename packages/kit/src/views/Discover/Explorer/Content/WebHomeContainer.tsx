import DiscoverHome from '../../Home';
import { useWebController } from '../Controller/useWebController';

const WebHomeContainer = () => {
  const { openMatchDApp } = useWebController();

  return (
    <DiscoverHome
      onItemSelect={(dapp) => {
        openMatchDApp({ id: dapp._id, dapp });
      }}
      onItemSelectHistory={openMatchDApp}
    />
  );
};

WebHomeContainer.displayName = 'WebHomeContainer';
export default WebHomeContainer;
