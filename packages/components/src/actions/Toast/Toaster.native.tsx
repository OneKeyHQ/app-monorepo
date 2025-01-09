import { Toasts } from '@backpackapp-io/react-native-toast';

import { TOAST_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';

import { View } from '../../primitives';

function ToastContainer() {
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
