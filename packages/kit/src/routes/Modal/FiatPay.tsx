import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import AmountInput from '@onekeyhq/kit/src/views/FiatPay/AmountInput';
import MoonpayWebView from '@onekeyhq/kit/src/views/FiatPay/MoonpayWebView';
import SupportTokenList from '@onekeyhq/kit/src/views/FiatPay/SupportTokenList';

import createStackNavigator from './createStackNavigator';

export enum FiatPayRoutes {
  SupportTokenListModal = 'SupportTokenList',
  AmoutInputModal = 'AmoutInputModal',
  MoonpayWebViewModal = 'MoonpayWebViewModal',
}

export type FiatPayModalRoutesParams = {
  [FiatPayRoutes.SupportTokenListModal]: undefined;
  [FiatPayRoutes.AmoutInputModal]: undefined;
  [FiatPayRoutes.MoonpayWebViewModal]: { url: string };
};

const BuyNavigator = createStackNavigator<FiatPayModalRoutesParams>();
const modalRoutes = [
  {
    name: FiatPayRoutes.SupportTokenListModal,
    component: SupportTokenList,
  },
  {
    name: FiatPayRoutes.AmoutInputModal,
    component: AmountInput,
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
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
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
