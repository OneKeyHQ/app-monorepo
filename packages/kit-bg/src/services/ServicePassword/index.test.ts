import ServicePassword from '.';

import { encodeSensitiveTextAsync } from '@onekeyhq/core/src/secret';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { EPasswordMode } from '@onekeyhq/shared/types/password';

const PASSWORD_VALIDATION_PROBE_ID =
  'password-validation-explicit-webcrypto-test';

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

describe('ServicePassword', () => {
  it('uses caller-provided KDF parameters when validating password rules', async () => {
    if (!appCrypto.pbkdf2.isWebCryptoPbkdf2Supported()) {
      return;
    }

    const password = await encodeSensitiveTextAsync({
      text: 'test-password',
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
    } as Parameters<typeof encodeSensitiveTextAsync>[0] & {
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });
    appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(
      PASSWORD_VALIDATION_PROBE_ID,
    );
    const servicePassword = Object.create(
      ServicePassword.prototype,
    ) as ServicePassword;

    await servicePassword.validatePasswordValidRules({
      password,
      passwordMode: EPasswordMode.PASSWORD,
      skipLengthCheck: true,
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
      debugCryptoProbeId: PASSWORD_VALIDATION_PROBE_ID,
    } as Parameters<ServicePassword['validatePasswordValidRules']>[0] & {
      debugCryptoProbeId: string;
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });

    expect(
      appCrypto.pbkdf2.getPbkdf2InvocationByProbeId(
        PASSWORD_VALIDATION_PROBE_ID,
      )?.backend,
    ).toBe('webcrypto');
  });
});
