import { useIsVerticalLayout } from '@onekeyhq/components';
import type { Device } from '@onekeyhq/engine/src/types/device';

import UpdateInfoModel from '../../../views/Hardware/UpdateFirmware/UpdateInfo';
import UpdateResourceModal from '../../../views/Hardware/UpdateFirmware/UpdateResource';
import UpdateWarningModel from '../../../views/Hardware/UpdateFirmware/UpdateWarning';
import UpdatingModel from '../../../views/Hardware/UpdateFirmware/Updating';
import UpdatingBootloaderModal from '../../../views/Hardware/UpdateFirmware/UpdatingBootloader';
import { HardwareUpdateModalRoutes } from '../../routesEnum';

import { buildModalStackNavigatorOptions } from './buildModalStackNavigatorOptions';
import createStackNavigator from './createStackNavigator';

import type { IResourceUpdateInfo } from '../../../utils/updates/type';

export type HardwareUpdateRoutesParams = {
  [HardwareUpdateModalRoutes.HardwareUpdateInfoModel]: (
    | { walletId: string }
    | { deviceId: string }
    | { connectId: string }
  ) & {
    recheckFirmwareUpdate?: boolean;
    onSuccess?: () => void;
  };
  [HardwareUpdateModalRoutes.HardwareUpdateWarningModal]: {
    device?: Device;
    resourceUpdateInfo?: IResourceUpdateInfo;
    shouldUpdateBootlader?: boolean;
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
  [HardwareUpdateModalRoutes.HardwareUpdatingModal]: {
    device?: Device;
    onSuccess?: () => void;
  };
  [HardwareUpdateModalRoutes.HardwareUpdatingBootloaderModal]: {
    device?: Device;
    onSuccess?: () => void;
  };
  [HardwareUpdateModalRoutes.HardwareUpdateResourceModal]: {
    device?: Device;
    resourceUpdateInfo?: IResourceUpdateInfo;
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
  {
    name: HardwareUpdateModalRoutes.HardwareUpdatingBootloaderModal,
    component: UpdatingBootloaderModal,
  },
  {
    name: HardwareUpdateModalRoutes.HardwareUpdateResourceModal,
    component: UpdateResourceModal,
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
