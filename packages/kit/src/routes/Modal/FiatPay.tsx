import { useIsVerticalLayout } from '@onekeyhq/components';
import MoonpayWebView from '@onekeyhq/kit/src/views/FiatPay/MoonpayWebView';
import SupportTokenList from '@onekeyhq/kit/src/views/FiatPay/SupportTokenList';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type { FiatPayModeType } from '../../views/FiatPay/types';

export enum FiatPayRoutes {
  SupportTokenListModal = 'SupportTokenList',
  MoonpayWebViewModal = 'MoonpayWebViewModal',
}

export type FiatPayModalRoutesParams = {
  [FiatPayRoutes.SupportTokenListModal]: {
    networkId: string;
    type?: FiatPayModeType;
  };
  [FiatPayRoutes.MoonpayWebViewModal]: { url: string };
};

const BuyNavigator = createStackNavigator<FiatPayModalRoutesParams>();
const modalRoutes = [
  {
    name: FiatPayRoutes.SupportTokenListModal,
    component: SupportTokenList,
  },
  {
    name: FiatPayRoutes.MoonpayWebViewModal,
    component: MoonpayWebView,
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
