import { EDeviceType } from '@onekeyfe/hd-shared';

import serviceHardwareUtils from './serviceHardwareUtils';

describe('serviceHardwareUtils.getHomeScreenServerDeviceType', () => {
  it('maps Pro 2 to Pro for the homescreen service', () => {
    expect(
      serviceHardwareUtils.getHomeScreenServerDeviceType(EDeviceType.Pro2),
    ).toBe(EDeviceType.Pro);
  });

  it('keeps other device types unchanged', () => {
    expect(
      serviceHardwareUtils.getHomeScreenServerDeviceType(EDeviceType.Touch),
    ).toBe(EDeviceType.Touch);
  });
});
