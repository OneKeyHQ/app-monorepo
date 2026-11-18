import { isFoldableIPhone } from './isFoldableIPhone.ios';

const mockDevice = { isDevice: true, modelId: null as string | null };
const mockIsDualScreenDevice = jest.fn(() => true);
const mockPlatformEnv = { isNativeIOSPad: false };

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockDevice.isDevice;
  },
  get modelId() {
    return mockDevice.modelId;
  },
}));

jest.mock('@onekeyfe/react-native-device-utils', () => ({
  ReactNativeDeviceUtils: {
    isDualScreenDevice: () => mockIsDualScreenDevice(),
  },
}));

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeIOSPad() {
      return mockPlatformEnv.isNativeIOSPad;
    },
  },
}));

describe('isFoldableIPhone (iOS)', () => {
  beforeEach(() => {
    mockDevice.isDevice = true;
    mockDevice.modelId = null;
    mockPlatformEnv.isNativeIOSPad = false;
    mockIsDualScreenDevice.mockReset().mockReturnValue(true);
  });

  it('ignores a native positive on a regular iPhone', () => {
    mockDevice.modelId = 'iPhone19,2';
    expect(isFoldableIPhone()).toBe(false);
  });

  it('detects iPhone Duo by model identifier', () => {
    mockDevice.modelId = 'iPhone19,4';
    mockIsDualScreenDevice.mockReturnValue(false);
    expect(isFoldableIPhone()).toBe(true);
  });

  it('returns false when the model identifier is missing', () => {
    expect(isFoldableIPhone()).toBe(false);
  });

  it('keeps the native answer on simulators', () => {
    mockDevice.isDevice = false;
    mockDevice.modelId = 'arm64';
    expect(isFoldableIPhone()).toBe(true);
    mockIsDualScreenDevice.mockReturnValue(false);
    expect(isFoldableIPhone()).toBe(false);
  });

  it('never reports iPad as a foldable iPhone', () => {
    mockPlatformEnv.isNativeIOSPad = true;
    mockDevice.modelId = 'iPhone19,4';
    expect(isFoldableIPhone()).toBe(false);
  });
});
