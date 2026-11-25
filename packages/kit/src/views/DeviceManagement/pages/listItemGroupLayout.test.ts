import { getDevicePageEndPadding } from './listItemGroupLayout';

let mockIsNativeAndroid = false;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    get isNativeAndroid() {
      return mockIsNativeAndroid;
    },
  },
}));

describe('getDevicePageEndPadding', () => {
  afterEach(() => {
    mockIsNativeAndroid = false;
  });

  it('ends 32 below the content on iOS, whatever the inset', () => {
    expect(getDevicePageEndPadding(0)).toBe(32);
    expect(getDevicePageEndPadding(34)).toBe(32);
  });

  it('keeps 32 on Android when the navigation bar is short', () => {
    mockIsNativeAndroid = true;
    expect(getDevicePageEndPadding(0)).toBe(32);
    expect(getDevicePageEndPadding(24)).toBe(32);
  });

  it('clears the Android 3-button navigation bar by 8', () => {
    mockIsNativeAndroid = true;
    expect(getDevicePageEndPadding(48)).toBe(56);
  });
});
