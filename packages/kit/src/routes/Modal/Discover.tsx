import { IconButton, useIsVerticalLayout } from '@onekeyhq/components';
import DAppList from '@onekeyhq/kit/src/views/Discover/DAppList';
import { SearchModalView } from '@onekeyhq/kit/src/views/Discover/Explorer/Search/SearchModalView';
import { ShareView } from '@onekeyhq/kit/src/views/Discover/Share';

import { getAppNavigation } from '../../hooks/useAppNavigation';
import MyDAppList from '../../views/Discover/MyDAppList';
import { DiscoverModalRoutes } from '../../views/Discover/type';

import createStackNavigator from './createStackNavigator';

import type { DiscoverRoutesParams } from '../../views/Discover/type';

const DiscoverNavigator = createStackNavigator<DiscoverRoutesParams>();

const withBackHeaderOptions = {
  headerShown: true,
  headerTitleAlign: 'center',
  headerLeft: () => (
    <IconButton
      size="xl"
      name="ChevronLeftOutline"
      type="plain"
      circle
      onPress={() => {
        getAppNavigation().goBack();
      }}
    />
  ),
};

const modalRoutes = [
  {
    name: DiscoverModalRoutes.SearchHistoryModal,
    component: SearchModalView,
  },
  {
    name: DiscoverModalRoutes.ShareModal,
    component: ShareView,
  },
  {
    name: DiscoverModalRoutes.DAppListModal,
    component: DAppList,
    options: withBackHeaderOptions,
  },
  {
    name: DiscoverModalRoutes.MyDAppListModal,
    component: MyDAppList,
    options: withBackHeaderOptions,
  },
];

const DiscoverModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <DiscoverNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <DiscoverNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
          // @ts-ignore
          options={route.options}
        />
      ))}
    </DiscoverNavigator.Navigator>
  );
};

export default DiscoverModalStack;
