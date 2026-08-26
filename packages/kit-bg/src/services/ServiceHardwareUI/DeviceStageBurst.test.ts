import { EDeviceType } from '@onekeyfe/hd-shared';

import { pickDeviceType } from './DeviceStageBurst';

describe('pickDeviceType', () => {
  it('keeps the device it already identified when an event does not know', () => {
    // SDK progress ticks carry no device and arrive stamped `unknown`;
    // taking that at face value dropped the replica mid-flow.
    expect(pickDeviceType(EDeviceType.Unknown, EDeviceType.Pro)).toBe(
      EDeviceType.Pro,
    );
  });

  it('learns the device the first time anything names it', () => {
    expect(pickDeviceType(EDeviceType.Pro, undefined)).toBe(EDeviceType.Pro);
  });

  it('lets a real model replace another', () => {
    expect(pickDeviceType(EDeviceType.Pro2, EDeviceType.Pro)).toBe(
      EDeviceType.Pro2,
    );
  });

  it('stays unknown while nothing has ever named the device', () => {
    expect(pickDeviceType(EDeviceType.Unknown, undefined)).toBe(
      EDeviceType.Unknown,
    );
  });
});
