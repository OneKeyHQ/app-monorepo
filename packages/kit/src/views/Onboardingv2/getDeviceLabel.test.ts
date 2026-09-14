import { EDeviceType } from '@onekeyfe/hd-shared';

import { getDeviceLabel } from './deviceLabel';

describe('getDeviceLabel', () => {
  it('keeps Pro 2 behind the shared OneKey Pro series copy', () => {
    expect(getDeviceLabel([EDeviceType.Pro])).toBe('OneKey Pro');
    expect(getDeviceLabel([EDeviceType.Pro2])).toBe('OneKey Pro');
    expect(getDeviceLabel([EDeviceType.Pro, EDeviceType.Pro2])).toBe(
      'OneKey Pro',
    );
  });

  it('labels Neo as its own product', () => {
    expect(getDeviceLabel([EDeviceType.Neo])).toBe('OneKey Neo');
  });

  it('keeps the other product labels joined by the separator', () => {
    expect(
      getDeviceLabel([EDeviceType.Classic1s, EDeviceType.ClassicPure]),
    ).toBe('OneKey Classic 1S/1S Pure');
    expect(getDeviceLabel([EDeviceType.Touch])).toBe('OneKey Touch');
    expect(getDeviceLabel([EDeviceType.Mini])).toBe('OneKey Mini');
  });
});
