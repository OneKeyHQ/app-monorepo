import { EDeviceType } from '@onekeyfe/hd-shared';

import settings from './settings';

describe('ADA hardware settings', () => {
  it('supports OneKey Pro 2 hardware wallets', () => {
    expect(settings.supportedDeviceTypes).toContain(EDeviceType.Pro2);
  });
});
