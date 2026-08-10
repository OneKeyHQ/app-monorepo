import { EDeviceType } from '@onekeyfe/hd-shared';

import { HwWalletAvatarImages } from './avatarUtils';
import { NEO_DEVICE_TYPE } from './hardwareDeviceTypes';

describe('HwWalletAvatarImages', () => {
  it.each([EDeviceType.Pro2, NEO_DEVICE_TYPE])(
    'uses the OneKey Pro artwork for %s',
    (deviceType) => {
      expect(HwWalletAvatarImages[deviceType]).toBe(
        HwWalletAvatarImages[EDeviceType.Pro],
      );
    },
  );
});
