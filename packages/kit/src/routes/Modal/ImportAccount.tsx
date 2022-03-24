import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ImportedAccountModal from '@onekeyhq/kit/src/views/Account/ImportedAccount';
import ImportedAccountAuthentication from '@onekeyhq/kit/src/views/Account/ImportedAccount/Authentication';

import createStackNavigator from './createStackNavigator';

export enum ImportAccountModalRoutes {
  ImportAccountModal = 'ImportedAccountForm',
  ImportAccountAuthentication = 'ImportAuthentication',
}

export type ImportAccountRoutesParams = {
  [ImportAccountModalRoutes.ImportAccountModal]: undefined;
  [ImportAccountModalRoutes.ImportAccountAuthentication]: {
    onDone: (password: string) => void;
  };
};

const ImportAccountNavigator =
  createStackNavigator<ImportAccountRoutesParams>();

const modalRoutes = [
  {
    name: ImportAccountModalRoutes.ImportAccountModal,
    component: ImportedAccountModal,
  },
  {
    name: ImportAccountModalRoutes.ImportAccountAuthentication,
    component: ImportedAccountAuthentication,
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
