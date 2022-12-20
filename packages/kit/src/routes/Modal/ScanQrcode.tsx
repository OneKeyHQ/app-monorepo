import { useIsVerticalLayout } from '@onekeyhq/components';
import PreviewSend from '@onekeyhq/kit/src/views/ScanQrcode/PreviewSend';
import ScanQrcode from '@onekeyhq/kit/src/views/ScanQrcode/ScanQrcode';
import ScanQrcodeResult from '@onekeyhq/kit/src/views/ScanQrcode/ScanQrcodeResult';
import type { ScanQrcodeRoutesParams } from '@onekeyhq/kit/src/views/ScanQrcode/types';
import { ScanQrcodeRoutes } from '@onekeyhq/kit/src/views/ScanQrcode/types';

import createStackNavigator from './createStackNavigator';

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
export { ScanQrcodeRoutes };
