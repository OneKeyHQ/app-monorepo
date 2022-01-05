import React from 'react';

import { createStackNavigator } from '@react-navigation/stack';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ImportedAccountModal from '@onekeyhq/kit/src/views/Account/ImportedAccount';

export enum ImportAccountModalRoutes {
  ImportAccountModal = 'ImportedAccountForm',
}

export type ImportAccountRoutesParams = {
  [ImportAccountModalRoutes.ImportAccountModal]: undefined;
};

const ImportAccountNavigator =
  createStackNavigator<ImportAccountRoutesParams>();

const modalRoutes = [
  {
    name: ImportAccountModalRoutes.ImportAccountModal,
    component: ImportedAccountModal,
  },
];

const ImportAccountModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ImportAccountNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ImportAccountNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ImportAccountNavigator.Navigator>
  );
};

export default ImportAccountModalStack;
