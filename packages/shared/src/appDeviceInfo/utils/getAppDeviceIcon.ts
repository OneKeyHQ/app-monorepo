import type { IKeyOfIcons } from '@onekeyhq/components';

import type { IPrimeDeviceInfo } from '../../../types/prime/primeTypes';

export function getAppDeviceIcon(device: IPrimeDeviceInfo): IKeyOfIcons {
  if (device.platform.startsWith('ios')) {
    return 'PhoneOutline';
  }
  if (device.platform.startsWith('android')) {
    return 'PhoneOutline';
  }
  if (device.platform.startsWith('desktop')) {
    return 'LaptopOutline';
  }
  if (device.platform.startsWith('web')) {
    return 'ChromeBrand';
  }
  if (device.platform.startsWith('extension')) {
    return 'ChromeBrand';
  }
  // iPad
  return 'PlaceholderOutline';
}
