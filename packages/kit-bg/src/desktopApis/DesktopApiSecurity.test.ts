import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import DesktopApiSecurity from './DesktopApiSecurity';

import type { IDesktopApi } from './instance/IDesktopApi';

jest.mock('electron', () => ({
  systemPreferences: {
    canPromptTouchID: jest.fn(() => false),
    promptTouchID: jest.fn(),
  },
}));

jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('@onekeyhq/desktop/app/service', () => ({
  checkAvailabilityAsync: jest.fn(async () => false),
  checkBiometricAuthChanged: jest.fn(async () => false),
  requestVerificationAsync: jest.fn(async () => ({ success: false })),
}));

describe('DesktopApiSecurity app session state', () => {
  const buildSecurityApi = () =>
    new DesktopApiSecurity({ desktopApi: {} as IDesktopApi });

  it('survives renderer calls in one Desktop process', async () => {
    const securityApi = buildSecurityApi();

    await expect(securityApi.getAppSessionUnlocked()).resolves.toBeUndefined();

    await securityApi.setAppSessionUnlocked(true);
    await expect(securityApi.getAppSessionUnlocked()).resolves.toBe(true);

    await securityApi.setAppSessionUnlocked(false);
    await expect(securityApi.getAppSessionUnlocked()).resolves.toBe(false);
  });

  it('does not survive a new Desktop process instance', async () => {
    const firstProcessSecurityApi = buildSecurityApi();
    await firstProcessSecurityApi.setAppSessionUnlocked(true);

    const restartedProcessSecurityApi = buildSecurityApi();

    await expect(
      restartedProcessSecurityApi.getAppSessionUnlocked(),
    ).resolves.toBeUndefined();
  });

  it('rejects invalid session state from the renderer boundary', async () => {
    const securityApi = buildSecurityApi();

    await expect(
      securityApi.setAppSessionUnlocked('true' as unknown as boolean),
    ).rejects.toThrow('Invalid Desktop app session state');
  });
});

describe('DesktopApiSecurity Windows Hello', () => {
  function buildWindowsSecurityApi() {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    let securityApi: DesktopApiSecurity | undefined;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    try {
      jest.isolateModules(() => {
        const { default: WindowsSecurityApi } = jest.requireActual<
          typeof import('./DesktopApiSecurity')
        >('./DesktopApiSecurity');
        securityApi = new WindowsSecurityApi({ desktopApi: {} as IDesktopApi });
      });
    } finally {
      if (descriptor) Object.defineProperty(process, 'platform', descriptor);
    }
    if (!securityApi) {
      throw new OneKeyLocalError('Windows security API was not initialized');
    }
    return securityApi;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers password authentication when the owned interface is unavailable', async () => {
    const service = jest.requireMock<
      jest.Mocked<typeof import('@onekeyhq/desktop/app/service')>
    >('@onekeyhq/desktop/app/service');
    service.checkAvailabilityAsync.mockResolvedValue(false);
    const securityApi = buildWindowsSecurityApi();
    await expect(securityApi.canPromptTouchID()).resolves.toBe(false);
    await expect(securityApi.promptTouchID('Unlock')).resolves.toEqual({
      success: false,
      isSupport: false,
    });
    expect(service.requestVerificationAsync).not.toHaveBeenCalled();
  });

  it.each(['user_cancel', 'app_cancel', 'retries_exhausted'])(
    'returns %s without another verification request',
    async (error) => {
      const service = jest.requireMock<
        jest.Mocked<typeof import('@onekeyhq/desktop/app/service')>
      >('@onekeyhq/desktop/app/service');
      service.checkAvailabilityAsync.mockResolvedValue(true);
      service.requestVerificationAsync.mockResolvedValue({
        success: false,
        error,
      });
      const securityApi = buildWindowsSecurityApi();
      await expect(securityApi.promptTouchID('Unlock')).resolves.toEqual({
        success: false,
        error,
        isSupport: true,
      });
      expect(service.requestVerificationAsync).toHaveBeenCalledTimes(1);
    },
  );
});
