import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { BIOLOGY_AUTH_CANCEL_ERROR } from '@onekeyhq/shared/types/password';

import { biologyAuthenticate } from './index.desktop';

jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1 },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isDesktopMac: true, isE2E: false },
}));
jest.mock('../locale', () => ({
  ETranslations: { global_unlock: 'global.unlock' },
}));
jest.mock('../locale/getDefaultLocale', () => ({
  getDefaultLocale: () => 'en-US',
  getLocaleMessages: async () => ({}),
}));
const mockBiologyAuthDebug = jest.fn();
jest.mock('../logger/logger', () => ({
  defaultLogger: {
    setting: {
      page: {
        biologyAuthDebug: (...args: unknown[]) => {
          mockBiologyAuthDebug(...args);
        },
      },
    },
  },
}));

type IGlobalWithProxy = {
  desktopApiProxy?: {
    security?: {
      canPromptTouchID: () => Promise<boolean>;
      promptTouchID: jest.Mock;
    };
  };
};

describe('desktop biometric prompt result', () => {
  const promptTouchID = jest.fn();

  beforeEach(() => {
    promptTouchID.mockReset();
    mockBiologyAuthDebug.mockClear();
    (globalThis as unknown as IGlobalWithProxy).desktopApiProxy = {
      security: { canPromptTouchID: async () => true, promptTouchID },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as IGlobalWithProxy).desktopApiProxy;
    platformEnv.isDesktopMac = true;
  });

  // Electron only forwards the OS-language description of the dismissal.
  it.each(['Authentication canceled.', '认证已取消。'])(
    'reports a dismissed macOS sheet (%s) as a cancel',
    async (message) => {
      promptTouchID.mockResolvedValue({
        success: false,
        error: message,
        isSupport: true,
      });
      await expect(biologyAuthenticate()).resolves.toEqual({
        success: false,
        error: BIOLOGY_AUTH_CANCEL_ERROR,
      });
      expect(mockBiologyAuthDebug).toHaveBeenCalledWith('touchId:rejected', {
        reason: message,
      });
    },
  );

  it('keeps Windows Hello results as reported', async () => {
    platformEnv.isDesktopMac = false;
    promptTouchID.mockResolvedValue({
      success: false,
      error: 'app_cancel',
      isSupport: true,
    });
    await expect(biologyAuthenticate()).resolves.toEqual({
      success: false,
      error: 'app_cancel',
      warning: 'app_cancel',
    });
    expect(mockBiologyAuthDebug).not.toHaveBeenCalled();
  });
});
