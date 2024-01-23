import { useIsVerticalLayout } from '@onekeyhq/components';

import PreviewSend from '../../../views/ScanQrcode/PreviewSend';
import RequestCameraPermissionExt from '../../../views/ScanQrcode/RequestCameraPermissionExt';
import ScanQrcode from '../../../views/ScanQrcode/ScanQrcode';
import ScanQrcodeResult from '../../../views/ScanQrcode/ScanQrcodeResult';
import { ScanQrcodeRoutes } from '../../../views/ScanQrcode/types';

import createStackNavigator from './createStackNavigator';

import type { ScanQrcodeRoutesParams } from '../../../views/ScanQrcode/types';

const ScanQrcodeNavigator = createStackNavigator<ScanQrcodeRoutesParams>();

const modalRoutes = [
  {
    name: ScanQrcodeRoutes.ScanQrcode,
    component: ScanQrcode,
  },
  { name: ScanQrcodeRoutes.ScanQrcodeResult, component: ScanQrcodeResult },

  {
    name: ScanQrcodeRoutes.PreviewSend,
    component: PreviewSend,
  },
  {
    name: ScanQrcodeRoutes.RequestPermission,
    component: RequestCameraPermissionExt,
  },
];

const ScanQrcodeStack = () => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <ScanQrcodeNavigator.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: !!isVerticalLayout,
      }}
    >
      {modalRoutes.map((route) => (
        <ScanQrcodeNavigator.Screen
          key={route.name}
          name={route.name}
          component={route.component}
        />
      ))}
    </ScanQrcodeNavigator.Navigator>
  );
};

export default ScanQrcodeStack;
export type { ScanQrcodeRoutesParams };
