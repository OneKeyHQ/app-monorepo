import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import DesktopApiSystem from './DesktopApiSystem';

import type { IDesktopApi } from './instance/IDesktopApi';

const mockOpenExternal = jest.fn<Promise<void>, [string]>();

jest.mock('electron', () => ({
  shell: { openExternal: (url: string) => mockOpenExternal(url) },
}));
jest.mock('@sentry/electron/main', () => ({}));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('systeminformation', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/desktop/app/libs/store', () => ({}));
jest.mock('@onekeyhq/desktop/app/libs/utils', () => ({}));
jest.mock('@onekeyhq/desktop/app/process', () => ({}));
jest.mock('@onekeyhq/desktop/app/resoucePath', () => ({}));

const originalPlatform = process.platform;

describe('DesktopApiSystem subscription management', () => {
  const createSystemApi = () =>
    new DesktopApiSystem({ desktopApi: {} as IDesktopApi });

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    mockOpenExternal.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('opens the fixed native App Store subscriptions page on macOS', async () => {
    await expect(createSystemApi().openAppStoreSubscriptions()).resolves.toBe(
      true,
    );
    expect(mockOpenExternal).toHaveBeenCalledTimes(1);
    expect(mockOpenExternal).toHaveBeenCalledWith(
      'macappstores://apps.apple.com/account/subscriptions',
    );
  });

  it.each(['win32', 'linux'] as const)(
    'reports unsupported on %s without opening a URL',
    async (platform) => {
      Object.defineProperty(process, 'platform', { value: platform });
      await expect(createSystemApi().openAppStoreSubscriptions()).resolves.toBe(
        false,
      );
      expect(mockOpenExternal).not.toHaveBeenCalled();
    },
  );

  it('propagates native handoff failure so the caller can fall back', async () => {
    const error = new OneKeyLocalError('App Store unavailable');
    mockOpenExternal.mockRejectedValueOnce(error);
    await expect(createSystemApi().openAppStoreSubscriptions()).rejects.toBe(
      error,
    );
  });
});
