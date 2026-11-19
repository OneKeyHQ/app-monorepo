/*
yarn jest packages/shared/src/modules3rdParty/appRestart/index.native.test.ts

The native restart entry runs the before-restart handlers only where the
background runtime is rebuilt inside the same process: every restart on iOS.
*/

const mockPlatformEnv = { isNativeIOS: true };
const mockRestart = jest.fn<Promise<void>, [string, string]>();
const mockEvents: string[] = [];

// The factories below run while the imports load, before the constants above
// are initialized, so they only read them later.
jest.mock('@onekeyfe/react-native-background-thread', () => ({
  BackgroundThread: {
    restart: (mode: string, reason: string) => mockRestart(mode, reason),
  },
}));

jest.mock('@onekeyfe/react-native-device-utils', () => ({
  ReactNativeDeviceUtils: {
    getConsecutiveBootFailCount: jest.fn(async () => 0),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    setting: { page: { restartApp: jest.fn() } },
    app: { bootRecovery: { log: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/modules/BootRecovery', () => ({
  __esModule: true,
  default: { markBootSuccess: jest.fn() },
}));

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeIOS() {
      return mockPlatformEnv.isNativeIOS;
    },
  },
}));

/* eslint-disable import/first */
import { addBeforeAppRestartHandler } from './beforeAppRestart';
import { EAppRestartMode, appRestart } from './index.native';
/* eslint-enable import/first */

describe('appRestart (native)', () => {
  let removeHandler: () => void = () => undefined;

  beforeEach(() => {
    mockEvents.length = 0;
    mockPlatformEnv.isNativeIOS = true;
    mockRestart.mockReset();
    mockRestart.mockImplementation(async () => {
      mockEvents.push('restart');
    });
    removeHandler = addBeforeAppRestartHandler(async () => {
      await Promise.resolve();
      mockEvents.push('handler');
    });
  });

  afterEach(() => {
    removeHandler();
  });

  it('runs the handlers before a full restart on iOS', async () => {
    await appRestart({ mode: EAppRestartMode.All, reason: 'ota.restart' });

    expect(mockEvents).toEqual(['handler', 'restart']);
    expect(mockRestart).toHaveBeenCalledWith('all', 'ota.restart');
  });

  it('runs them before a UI restart on iOS too, which also rebuilds the background runtime', async () => {
    await appRestart({ mode: EAppRestartMode.UI, reason: 'setting.currency' });

    expect(mockEvents).toEqual(['handler', 'restart']);
    expect(mockRestart).toHaveBeenCalledWith('ui', 'setting.currency');
  });

  it.each([EAppRestartMode.All, EAppRestartMode.UI])(
    'skips them on Android (mode %s), where nothing outlives its runtime',
    async (mode) => {
      mockPlatformEnv.isNativeIOS = false;

      await appRestart({ mode, reason: 'ota.restart' });

      expect(mockEvents).toEqual(['restart']);
    },
  );
});
