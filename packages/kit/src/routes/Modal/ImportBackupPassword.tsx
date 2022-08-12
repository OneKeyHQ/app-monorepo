import React from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';
import ImportBackupPasswordModal from '@onekeyhq/kit/src/views/Me/SecuritySection/CloudBackup/ImportBackupPasswordModal';

import createStackNavigator from './createStackNavigator';

export enum ImportBackupPasswordRoutes {
  ImportBackupPassword = 'ImportBackupPassword',
}

export type ImportBackupPasswordRoutesParams = {
  [ImportBackupPasswordRoutes.ImportBackupPassword]: {
    onSuccess: (backupPassword: string) => void;
    onCancel: () => void;
  };
};

const Navigator = createStackNavigator<ImportBackupPasswordRoutesParams>();

const modalRoutes = [
  {
    name: ImportBackupPasswordRoutes.ImportBackupPassword,
    component: ImportBackupPasswordModal,
  },
];

const ImportBackupPasswordModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <Navigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <Navigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </Navigator.Navigator>
  );
};

export default ImportBackupPasswordModalStack;
