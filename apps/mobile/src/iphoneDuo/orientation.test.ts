const mockUnlockAsync = jest.fn(async () => undefined);
const mockPlatformEnv = { isNativeIOS: true, isNativeIOSPad: false };
let mockIsDualScreenDevice = false;
let mockSpanningListener: ((isSpanning: boolean) => void) | undefined;
const mockRemoveSpanningChangedListener = jest.fn();

jest.mock('expo-screen-orientation', () => ({
  unlockAsync: mockUnlockAsync,
}));

jest.mock('@onekeyfe/react-native-device-utils', () => ({
  ReactNativeDeviceUtils: {
    isDualScreenDevice: () => mockIsDualScreenDevice,
    addSpanningChangedListener: (callback: (isSpanning: boolean) => void) => {
      mockSpanningListener = callback;
      return 7;
    },
    removeSpanningChangedListener: mockRemoveSpanningChangedListener,
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));

function loadModule() {
  let loaded: typeof import('./orientation') | undefined;
  jest.isolateModules(() => {
    loaded =
      jest.requireActual<typeof import('./orientation')>('./orientation');
  });
  return loaded as typeof import('./orientation');
}

describe('iPhone Duo orientation', () => {
  beforeEach(() => {
    mockUnlockAsync.mockClear();
    mockRemoveSpanningChangedListener.mockClear();
    mockSpanningListener = undefined;
    mockIsDualScreenDevice = false;
    mockPlatformEnv.isNativeIOS = true;
    mockPlatformEnv.isNativeIOSPad = false;
  });

  it('unlocks once at launch on a known foldable iPhone', () => {
    mockIsDualScreenDevice = true;
    const { initIPhoneDuoOrientation } = loadModule();
    initIPhoneDuoOrientation();
    initIPhoneDuoOrientation();
    expect(mockUnlockAsync).toHaveBeenCalledTimes(1);
    expect(mockSpanningListener).toBeUndefined();
  });

  it('keeps the portrait lock on regular iPhones', () => {
    loadModule().initIPhoneDuoOrientation();
    mockSpanningListener?.(false);
    expect(mockUnlockAsync).not.toHaveBeenCalled();
    expect(mockRemoveSpanningChangedListener).not.toHaveBeenCalled();
  });

  it('unlocks once the hinge check confirms an unlisted model', () => {
    loadModule().initIPhoneDuoOrientation();
    expect(mockUnlockAsync).not.toHaveBeenCalled();

    mockIsDualScreenDevice = true;
    mockSpanningListener?.(true);
    expect(mockUnlockAsync).toHaveBeenCalledTimes(1);
    expect(mockRemoveSpanningChangedListener).toHaveBeenCalledWith(7);
  });

  it('does nothing on iPad', () => {
    mockPlatformEnv.isNativeIOSPad = true;
    mockIsDualScreenDevice = true;
    loadModule().initIPhoneDuoOrientation();
    expect(mockUnlockAsync).not.toHaveBeenCalled();
  });
});
