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
