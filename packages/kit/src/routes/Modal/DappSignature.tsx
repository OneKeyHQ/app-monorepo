import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import Signature from '@onekeyhq/kit/src/views/DappModals/Signature';

export enum DappSignatureModalRoutes {
  SignatureModal = 'SignatureModal',
}

export type DappSignatureRoutesParams = {
  [DappSignatureModalRoutes.SignatureModal]: undefined;
};

const DappSignatureNavigator =
  createStackNavigator<DappSignatureRoutesParams>();

const modalRoutes = [
  {
    name: DappSignatureModalRoutes.SignatureModal,
    component: Signature,
  },
];

const DappSignatureModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <DappSignatureNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <DappSignatureNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </DappSignatureNavigator.Navigator>
  );
};

export default DappSignatureModalStack;
