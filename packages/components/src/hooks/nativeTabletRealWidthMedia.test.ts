import path from 'path';

const mockWindow = { width: 1366, height: 1024 };
let mockIsPad = true;
let mockIsSpanning = false;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeIOSPad() {
      return mockIsPad;
    },
  },
}));

jest.mock('react-native', () => ({
  Dimensions: { get: () => mockWindow, addEventListener: jest.fn() },
  Platform: { OS: 'ios' },
}));

jest.mock('expo-device', () => ({
  get deviceType() {
    return mockIsPad ? 2 : 1;
  },
  DeviceType: { PHONE: 1, TABLET: 2 },
}));
jest.mock('expo-screen-orientation', () => ({
  addOrientationChangeListener: jest.fn(),
}));
jest.mock('@onekeyfe/react-native-device-utils', () => ({
  ReactNativeDeviceUtils: {
    isDualScreenDevice: () => mockIsSpanning,
    isSpanning: () => mockIsSpanning,
    addSpanningChangedListener: jest.fn(),
  },
}));

function loadMedia(query = '(min-width: 900px)') {
  const driverPath = path.join(
    path.dirname(
      require.resolve('@tamagui/react-native-media-driver/package.json'),
    ),
    'dist/cjs/mediaQueryList.native.js',
  );
  const { NativeMediaQueryList } = jest.requireActual<{
    NativeMediaQueryList: new (query: string) => {
      matches: boolean;
      addListener: (listener: () => void) => void;
    };
  }>(driverPath);
  const control = jest.requireActual<
    typeof import('./nativeTabletRealWidthMedia.native')
  >('./nativeTabletRealWidthMedia.native');
  return { media: new NativeMediaQueryList(query), ...control };
}

describe('native tablet real-width media', () => {
  beforeEach(() => {
    jest.resetModules();
    delete globalThis.$$onekeyNativeMedia;
    mockIsPad = true;
    mockIsSpanning = false;
    mockWindow.width = 1366;
    mockWindow.height = 1024;
  });

  afterEach(() => {
    delete globalThis.$$onekeyNativeMedia;
  });

  it('refreshes the actual native driver and releases only the final holder', () => {
    const {
      media,
      acquireNativeTabletRealWidthMedia: acquire,
      releaseNativeTabletRealWidthMedia: release,
    } = loadMedia();
    const listener = jest.fn();
    media.addListener(listener);
    expect(media.matches).toBe(false);
    acquire();
    expect(media.matches).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    acquire();
    release();
    expect(media.matches).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    mockWindow.width = 1024;
    mockWindow.height = 1366;
    expect(media.matches).toBe(true);
    release();
    expect(media.matches).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps dual-screen spanning constrained even while acquired', () => {
    mockIsSpanning = true;
    const { media, acquireNativeTabletRealWidthMedia: acquire } = loadMedia();
    acquire();
    expect(media.matches).toBe(false);
  });

  it('does not acquire real width outside iPad', () => {
    mockIsPad = false;
    mockWindow.width = 402;
    mockWindow.height = 874;
    const { media, acquireNativeTabletRealWidthMedia: acquire } = loadMedia();
    acquire();
    expect(globalThis.$$onekeyNativeMedia?.useRealWidth).toBe(false);
    expect(media.matches).toBe(false);
  });

  it('keeps iPhone width breakpoints mobile through system rotation', () => {
    mockIsPad = false;
    mockWindow.width = 402;
    mockWindow.height = 874;
    const { media } = loadMedia('(max-width: 639px)');
    const { media: shortWindow } = loadMedia('(max-height: 820px)');
    const { media: landscape } = loadMedia('(orientation: landscape)');
    expect(media.matches).toBe(true);
    expect(shortWindow.matches).toBe(false);
    expect(landscape.matches).toBe(false);

    mockWindow.width = 874;
    mockWindow.height = 402;
    expect(media.matches).toBe(true);
    expect(shortWindow.matches).toBe(true);
    expect(landscape.matches).toBe(true);
  });
});
