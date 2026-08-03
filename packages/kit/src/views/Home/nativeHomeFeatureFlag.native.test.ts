import { isNativeHomeEnabled } from './nativeHomeFeatureFlag.native';

describe('isNativeHomeEnabled', () => {
  it('uses the app-owned renderer switch when one is supplied', () => {
    expect(isNativeHomeEnabled()).toBe(true);
    expect(isNativeHomeEnabled(true)).toBe(true);
    expect(isNativeHomeEnabled(false)).toBe(false);
  });
});
