import {
  ONEKEY_ID_AUTH_CONFIG,
  SUPABASE_RELAY_PATH,
} from '../consts/authConsts';
import requestHelper from '../request/requestHelper';

import {
  getOneKeyIdAuthConfig,
  getOneKeyIdAuthConfigByDevSettings,
} from './oneKeyIdAuth';

jest.mock('../request/requestHelper', () => ({
  __esModule: true,
  default: { getDevSettingsPersistAtom: jest.fn() },
}));

describe('OneKey ID environment selection', () => {
  test.each([
    { enabled: false, testEndpoint: false, environment: 'prod' as const },
    { enabled: false, testEndpoint: true, environment: 'prod' as const },
    { enabled: true, testEndpoint: false, environment: 'prod' as const },
    { enabled: true, testEndpoint: true, environment: 'test' as const },
  ])(
    '$enabled/$testEndpoint selects $environment with CAPTCHA enabled',
    ({ enabled, testEndpoint, environment }) => {
      const config = getOneKeyIdAuthConfigByDevSettings({
        enabled,
        settings: { enableTestEndpoint: testEndpoint },
      });
      expect(config).toBe(ONEKEY_ID_AUTH_CONFIG[environment]);
      expect(config.captcha.enabled).toBe(true);
      expect(config.captcha.pageUrl).toBe(
        environment === 'test'
          ? 'https://login.onekeytest.com/captcha'
          : 'https://login.onekey.so/captcha',
      );
      expect(new URL(config.projectUrl).hostname).toBe(
        environment === 'test' ? 'prime.onekeytest.com' : 'prime.onekeycn.com',
      );
      expect(new URL(config.projectUrl).pathname).toBe(SUPABASE_RELAY_PATH);
      expect(config.publicKey).toBe('onekey-123-321-000-999-888');
    },
  );

  test('waits for persisted node settings instead of choosing a startup default', async () => {
    let resolve!: (settings: {
      enabled: boolean;
      settings: { enableTestEndpoint: boolean };
    }) => void;
    jest.mocked(requestHelper.getDevSettingsPersistAtom).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const settled = jest.fn();
    const pending = getOneKeyIdAuthConfig().then(settled);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    resolve({ enabled: true, settings: { enableTestEndpoint: true } });
    await pending;
    expect(settled).toHaveBeenCalledWith(ONEKEY_ID_AUTH_CONFIG.test);
  });

  test('does not silently use production when settings cannot be read', async () => {
    jest
      .mocked(requestHelper.getDevSettingsPersistAtom)
      .mockRejectedValueOnce(new Error('settings unavailable'));
    await expect(getOneKeyIdAuthConfig()).rejects.toThrow(
      'settings unavailable',
    );
  });
});
