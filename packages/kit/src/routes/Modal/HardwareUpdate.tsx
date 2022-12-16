import { useIsVerticalLayout } from '@onekeyhq/components';
import type { Device } from '@onekeyhq/engine/src/types/device';

import UpdateInfoModel from '../../views/Hardware/UpdateFirmware/UpdateInfo';
import UpdateWarningModel from '../../views/Hardware/UpdateFirmware/UpdateWarning';
import UpdatingModel from '../../views/Hardware/UpdateFirmware/Updating';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

export enum HardwareUpdateModalRoutes {
  HardwareUpdateInfoModel = 'HardwareUpdateInfoModel',
  HardwareUpdateWarningModal = 'HardwareUpdateWarningModal',
  HardwareUpdateWarningPowerModal = 'HardwareUpdateWarningPowerModal',
  HardwareUpdatingModal = 'HardwareUpdatingModal',
}

export type HardwareUpdateRoutesParams = {
  [HardwareUpdateModalRoutes.HardwareUpdateInfoModel]: (
    | { walletId: string }
    | { deviceId: string }
  ) & {
    recheckFirmwareUpdate?: boolean;
    onSuccess?: () => void;
  };
  [HardwareUpdateModalRoutes.HardwareUpdateWarningModal]: {
    device?: Device;
    onSuccess?: () => void;
  };
  [HardwareUpdateModalRoutes.HardwareUpdateWarningPowerModal]: {
    device?: Device;
    onSuccess?: () => void;
  };
  [HardwareUpdateModalRoutes.HardwareUpdatingModal]: {
    device?: Device;
    onSuccess?: () => void;
  };
};

const HardwareUpdateNavigator =
  createStackNavigator<HardwareUpdateRoutesParams>();

const modalRoutes = [
  {
    name: HardwareUpdateModalRoutes.HardwareUpdateInfoModel,
    component: UpdateInfoModel,
  },
  {
    name: HardwareUpdateModalRoutes.HardwareUpdateWarningModal,
    component: UpdateWarningModel,
  },
  {
    name: HardwareUpdateModalRoutes.HardwareUpdatingModal,
    component: UpdatingModel,
  },
];

const HardwareUpdateModalStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <HardwareUpdateNavigator.Navigator
      screenOptions={(navInfo) => ({
        headerShown: false,
        ...buildModalStackNavigatorOptions({ isVerticalLayout, navInfo }),
      })}
    >
      {modalRoutes.map((route) => (
        <HardwareUpdateNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </HardwareUpdateNavigator.Navigator>
  );
};

export default HardwareUpdateModalStack;
