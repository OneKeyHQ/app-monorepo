/* eslint-disable import/first */
jest.mock('electron', () => ({ systemPreferences: {} }));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));
jest.mock('@onekeyhq/desktop/app/service', () => ({
  checkBiometricAuthChanged: jest.fn(),
}));

import { checkBiometricAuthChanged } from '@onekeyhq/desktop/app/service';

describe('DesktopApiSecurity biometric errors', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  afterEach(() => {
    if (originalPlatform)
      Object.defineProperty(process, 'platform', originalPlatform);
  });

  it('preserves rejection through the desktop API boundary', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    let api!: import('./DesktopApiSecurity').default;
    jest.isolateModules(() => {
      const Security = (
        require('./DesktopApiSecurity') as typeof import('./DesktopApiSecurity')
      ).default;
      api = Object.create(
        Security.prototype,
      ) as import('./DesktopApiSecurity').default;
    });
    jest
      .mocked(checkBiometricAuthChanged)
      .mockRejectedValue(new Error('timed out'));
    await expect(api.checkBiometricAuthChanged()).rejects.toThrow('timed out');
  });
});
