import { EDeviceType } from '@onekeyfe/hd-shared';

import { getDeviceLabel } from './deviceLabel';

describe('getDeviceLabel', () => {
  it('uses a native label for each product type', () => {
    expect(getDeviceLabel([EDeviceType.Pro])).toBe('OneKey Pro');
    expect(getDeviceLabel([EDeviceType.Pro2])).toBe('OneKey Pro 2');
    expect(getDeviceLabel([EDeviceType.Neo])).toBe('OneKey Neo');
    expect(
      getDeviceLabel([EDeviceType.Pro, EDeviceType.Pro2, EDeviceType.Neo]),
    ).toBe('OneKey Pro');
  });

  it('keeps the other product labels joined by the separator', () => {
    expect(
      getDeviceLabel([EDeviceType.Classic1s, EDeviceType.ClassicPure]),
    ).toBe('OneKey Classic 1S/1S Pure');
    expect(getDeviceLabel([EDeviceType.Touch])).toBe('OneKey Touch');
    expect(getDeviceLabel([EDeviceType.Mini])).toBe('OneKey Mini');
  });
});
