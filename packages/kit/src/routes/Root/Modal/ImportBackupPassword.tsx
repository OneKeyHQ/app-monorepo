import { useIsVerticalLayout } from '@onekeyhq/components';
import type { RestoreResult } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.enums';

import ImportBackupPasswordModal from '../../../views/Me/SecuritySection/CloudBackup/ImportBackupPasswordModal';
import { ImportBackupPasswordModalRoutes } from '../../routesEnum';

import createStackNavigator from './createStackNavigator';

export type ImportBackupPasswordRoutesParams = {
  [ImportBackupPasswordModalRoutes.ImportBackupPassword]: {
    withPassword: (backupPassword: string) => Promise<RestoreResult>;
    onSuccess: () => Promise<void>;
    onError: () => void;
    onCancel?: () => void;
  };
};

const Navigator = createStackNavigator<ImportBackupPasswordRoutesParams>();

const modalRoutes = [
  {
    name: ImportBackupPasswordModalRoutes.ImportBackupPassword,
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
