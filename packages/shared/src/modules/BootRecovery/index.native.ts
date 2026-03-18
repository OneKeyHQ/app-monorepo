import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

const BootRecovery = {
  markBootSuccess(): void {
    ReactNativeDeviceUtils.markBootSuccess();
  },
  setConsecutiveBootFailCount(count: number): void {
    ReactNativeDeviceUtils.setConsecutiveBootFailCount(count);
  },
  async getAndClearRecoveryAction(): Promise<string> {
    return ReactNativeDeviceUtils.getAndClearRecoveryAction();
  },
};

export default BootRecovery;
