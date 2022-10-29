import { WebTab } from '../../../../store/reducers/webTabs';
import DiscoverHome from '../../Home';
import { useWebController } from '../Controller/useWebController';

const WebContent = ({ id }: WebTab) => {
  const { openMatchDApp } = useWebController({
    id,
  });

  return (
    <DiscoverHome
      onItemSelect={(dapp) => {
        openMatchDApp({ id: dapp._id, dapp });
      }}
      onItemSelectHistory={openMatchDApp}
    />
  );
};

WebContent.displayName = 'WebContent';

export default WebContent;
