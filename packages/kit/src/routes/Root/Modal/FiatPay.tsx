import { useIsVerticalLayout } from '@onekeyhq/components';

import SupportTokenList from '../../../views/FiatPay/SupportTokenList';
import { FiatPayModalRoutes } from '../../routesEnum';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type { FiatPayModeType } from '../../../views/FiatPay/types';

export type FiatPayModalRoutesParams = {
  [FiatPayModalRoutes.SupportTokenListModal]: {
    networkId: string;
    accountId: string;
    type?: FiatPayModeType;
  };
};

const BuyNavigator = createStackNavigator<FiatPayModalRoutesParams>();
const modalRoutes = [
  {
    name: FiatPayModalRoutes.SupportTokenListModal,
    component: SupportTokenList,
  },
];

const FiatPayModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <BuyNavigator.Navigator
      screenOptions={(navInfo) => ({
        headerShown: false,
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
    >
      {modalRoutes.map((route) => (
        <BuyNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </BuyNavigator.Navigator>
  );
};

export default FiatPayModalStack;
