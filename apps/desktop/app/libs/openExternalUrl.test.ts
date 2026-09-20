import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { openExternalUrl } from './openExternalUrl';

const mockOpenExternal = jest.fn<Promise<void>, [string]>();

jest.mock('electron', () => ({
  shell: { openExternal: (url: string) => mockOpenExternal(url) },
}));
jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: { warn: jest.fn() },
}));

const appleUrl = 'https://apps.apple.com/account/subscriptions';
const nativeUrl = 'macappstores://apps.apple.com/account/subscriptions';
const originalPlatform = process.platform;

describe('desktop external URLs', () => {
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    mockOpenExternal.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('opens the macOS App Store subscriptions sheet for the Apple HTTPS entry', async () => {
    await openExternalUrl(appleUrl);
    expect(mockOpenExternal).toHaveBeenCalledTimes(1);
    expect(mockOpenExternal).toHaveBeenCalledWith(nativeUrl);
  });

  it.each(['win32', 'linux'] as const)(
    'preserves the Apple HTTPS entry on %s',
    async (platform) => {
      Object.defineProperty(process, 'platform', { value: platform });
      await openExternalUrl(appleUrl);
      expect(mockOpenExternal).toHaveBeenCalledWith(appleUrl);
    },
  );

  it('falls back to the Apple HTTPS entry when App Store handoff fails', async () => {
    mockOpenExternal.mockRejectedValueOnce(
      new OneKeyLocalError('App Store unavailable'),
    );
    await openExternalUrl(appleUrl);
    expect(mockOpenExternal).toHaveBeenNthCalledWith(1, nativeUrl);
    expect(mockOpenExternal).toHaveBeenNthCalledWith(2, appleUrl);
  });

  it.each([
    'https://onekey.so',
    'mailto:support@example.com',
    'https://apps.apple.com/account/subscriptions?redirect=example.com',
    'https://apps.apple.com.example.com/account/subscriptions',
    'https://apps.apple.com@other.example.com/account/subscriptions',
  ])('keeps other approved URLs unchanged: %s', async (url) => {
    await openExternalUrl(url);
    expect(mockOpenExternal).toHaveBeenCalledWith(url);
  });

  it.each([
    'http://example.com',
    // eslint-disable-next-line no-script-url -- Regression fixture for blocked renderer URLs.
    'javascript:alert(1)',
    'file:///tmp/test.html',
    'data:text/html,test',
    'not a URL',
    nativeUrl,
    'macappstores://example.com',
  ])('still blocks unapproved renderer URLs: %s', async (url) => {
    await openExternalUrl(url);
    expect(mockOpenExternal).not.toHaveBeenCalled();
  });
});
