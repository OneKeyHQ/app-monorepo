import { IconButton, useIsVerticalLayout } from '@onekeyhq/components';
import DAppList from '@onekeyhq/kit/src/views/Discover/DAppList';
import { SearchModalView } from '@onekeyhq/kit/src/views/Discover/Explorer/Search/SearchModalView';
import MyDAppList from '@onekeyhq/kit/src/views/Discover/MyDAppList';
import { ShareView } from '@onekeyhq/kit/src/views/Discover/Share';

import { getAppNavigation } from '../../hooks/useAppNavigation';
import { MatchDAppItemType } from '../../views/Discover/Explorer/explorerUtils';
import { DAppItemType } from '../../views/Discover/type';

import createStackNavigator from './createStackNavigator';

export enum DiscoverModalRoutes {
  SearchHistoryModal = 'SearchHistoryModal',
  ShareModal = 'ShareModal',
  DAppListModal = 'DAppListModal',
  MyDAppListModal = 'MyDAppListModal',
}

export type DiscoverRoutesParams = {
  [DiscoverModalRoutes.SearchHistoryModal]: {
    url: string | undefined;
    onSelectorItem?: (item: MatchDAppItemType | string) => void;
  };
  [DiscoverModalRoutes.ShareModal]: {
    url: string;
    name?: string;
    logoURL?: string;
  };
  [DiscoverModalRoutes.DAppListModal]: {
    title: string;
    data: DAppItemType[];
    onItemSelect?: (item: DAppItemType) => void;
  };
  [DiscoverModalRoutes.MyDAppListModal]: {
    defaultIndex?: number;
    onItemSelect?: (item: MatchDAppItemType) => void;
  };
};

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
