import { EDeviceType } from '@onekeyfe/hd-shared';

import { NEO_DEVICE_TYPE } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';

import settings from './settings';

describe('ADA hardware settings', () => {
  it('supports Pro 2 and Neo hardware wallets together', () => {
    expect(settings.supportedDeviceTypes).toContain(EDeviceType.Pro2);
    expect(settings.supportedDeviceTypes).toContain(NEO_DEVICE_TYPE);
  });
});
