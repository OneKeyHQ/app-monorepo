import { Toasts } from '@backpackapp-io/react-native-toast';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { TOAST_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import { View } from '../../primitives';

function ToastContainer() {
  if (platformEnv.isNativeIOS) {
    // TODO:
    // On iOS, need to create a higher level native view layer above window overlay
    //  to ensure toasts are always visible
    return <Toasts />;
  }
  return (
    <View
      position="absolute"
      left={0}
      top={0}
      right={0}
      bottom={0}
      pointerEvents="box-none"
      zIndex={TOAST_Z_INDEX}
    >
      <Toasts />
    </View>
  );
}

export default ToastContainer;
