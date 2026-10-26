import { usableWindowBottom } from './usableWindowBottom';

describe('usableWindowBottom', () => {
  it('ends at the bottom inset while the keyboard is down', () => {
    expect(usableWindowBottom(852, 34, 0, false)).toBe(818);
  });

  it('ends at the keyboard on iOS — its height spans the home indicator', () => {
    expect(usableWindowBottom(852, 34, 336, false)).toBe(516);
  });

  it('stacks the system bar under the keyboard on Android', () => {
    expect(usableWindowBottom(640, 48, 270, true)).toBe(322);
  });
});
