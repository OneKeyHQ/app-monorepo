import { useIsVerticalLayout } from '@onekeyhq/components';

import CalculatorModal from '../../../views/NFTMarket/Modals/Calculator';
import MarketPlaceList from '../../../views/NFTMarket/Modals/Calculator/MarketPlaceList';
import NFTSearchModal from '../../../views/NFTMarket/Modals/NFTSearchModal';
import ShareNFTPNLModal from '../../../views/NFTMarket/Modals/Share';
import { NFTMarketRoutes } from '../../../views/NFTMarket/Modals/type';

import createStackNavigator from './createStackNavigator';

import type { NFTMarketRoutesParams } from '../../../views/NFTMarket/Modals/type';

const NFTMarketNavigator = createStackNavigator<NFTMarketRoutesParams>();

const modalRoutes = [
  {
    name: NFTMarketRoutes.SearchModal,
    component: NFTSearchModal,
  },
  {
    name: NFTMarketRoutes.ShareNFTPNLModal,
    component: ShareNFTPNLModal,
  },
  {
    name: NFTMarketRoutes.CalculatorModal,
    component: CalculatorModal,
  },
  {
    name: NFTMarketRoutes.MarketPlaceScreen,
    component: MarketPlaceList,
  },
];

const NFTMarketStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <NFTMarketNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <NFTMarketNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </NFTMarketNavigator.Navigator>
  );
};

export default NFTMarketStack;
export type { NFTMarketRoutesParams };
