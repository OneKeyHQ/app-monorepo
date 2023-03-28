import { IconButton, useIsVerticalLayout } from '@onekeyhq/components';

import { getAppNavigation } from '../../../hooks/useAppNavigation';
import DAppList from '../../../views/Discover/DAppList';
import { EditBookmark } from '../../../views/Discover/EditBookmark';
import { SearchModalView } from '../../../views/Discover/Explorer/Search/SearchModalView';
import MyDAppList from '../../../views/Discover/MyDAppList';
import { ShareView } from '../../../views/Discover/Share';
import { DiscoverModalRoutes } from '../../../views/Discover/type';

import createStackNavigator from './createStackNavigator';

import type { DiscoverRoutesParams } from '../../../views/Discover/type';

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
  {
    name: DiscoverModalRoutes.EditBookmark,
    component: EditBookmark,
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
