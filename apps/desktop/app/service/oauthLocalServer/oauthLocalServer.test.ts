import {
  KEYLESS_SUPABASE_PROJECT_URL,
  SUPABASE_PROJECT_URL,
} from '@onekeyhq/shared/src/consts/authConsts';

import { openOAuthBrowser } from './oauthLocalServer';

const mockOpenExternal = jest.fn<Promise<void>, [string]>(async () => {});

jest.mock('electron', () => ({
  app: { getApplicationNameForProtocol: jest.fn() },
  shell: { openExternal: (url: string) => mockOpenExternal(url) },
}));
jest.mock('../../i18n', () => ({ getLocale: () => 'en' }));
jest.mock('child_process', () => ({ spawn: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test.each([SUPABASE_PROJECT_URL, KEYLESS_SUPABASE_PROJECT_URL])(
  'opens the configured OAuth origin %s',
  async (origin) => {
    const url = `${origin}/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2F127.0.0.1%3A1234`;
    await openOAuthBrowser(url);
    expect(mockOpenExternal).toHaveBeenCalledWith(url);
  },
);

test.each([
  'file:///tmp/fixture',
  'mailto:fixture@example.test',
  // eslint-disable-next-line no-script-url -- Exercise rejection of executable protocols.
  'javascript:alert(1)',
  'ms-settings:privacy',
  'http://auth.onekey.so/auth/v1/authorize',
  'https://auth.onekey.so.evil.test/',
  'https://auth.onekey.so@evil.test/',
  'https://evil.test/',
  'https://auth.onekey.so:444/',
  'https://user:pass@auth.onekey.so/',
  'not a URL',
])('rejects %s without opening an external program', async (url) => {
  await expect(openOAuthBrowser(url)).rejects.toThrow();
  expect(mockOpenExternal).not.toHaveBeenCalled();
});
