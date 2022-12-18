import { useIsVerticalLayout } from '@onekeyhq/components';

import NFTSearchModal from '../../views/NFTMarket/NFTSearchModal';
import { SearchNFTCollectionRoutes } from '../../views/NFTMarket/NFTSearchModal/type';

import createStackNavigator from './createStackNavigator';

import type { SearchNFTCollectionRoutesParams } from '../../views/NFTMarket/NFTSearchModal/type';

const SearchNFTCollectionNavigator =
  createStackNavigator<SearchNFTCollectionRoutesParams>();

const modalRoutes = [
  {
    name: SearchNFTCollectionRoutes.SearchModal,
    component: NFTSearchModal,
  },
];

const SearchNFTCollectionStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <SearchNFTCollectionNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <SearchNFTCollectionNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </SearchNFTCollectionNavigator.Navigator>
  );
};

export default SearchNFTCollectionStack;
export { SearchNFTCollectionRoutes };
export type { SearchNFTCollectionRoutesParams };
