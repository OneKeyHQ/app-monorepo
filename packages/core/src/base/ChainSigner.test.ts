import appCrypto from '@onekeyhq/shared/src/appCrypto';

import { encryptAsync } from '../secret';

import { ChainSigner } from './ChainSigner';

const CHAIN_SIGNER_PROBE_ID = 'chain-signer-explicit-webcrypto-test';

describe('ChainSigner', () => {
  it('uses caller-provided KDF parameters when signing', async () => {
    if (!appCrypto.pbkdf2.isWebCryptoPbkdf2Supported()) {
      return;
    }

    const password = 'test-password';
    const encryptedPrivateKey = await encryptAsync({
      password,
      data: Buffer.alloc(32, 1),
      allowRawPassword: true,
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
    });
    appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(CHAIN_SIGNER_PROBE_ID);
    const ChainSignerWithKdf = ChainSigner as unknown as new (
      privateKey: Buffer,
      signerPassword: string,
      curve: 'secp256k1',
      kdfParams: {
        debugCryptoProbeId: string;
        enablePbkdf2Cache: boolean;
        kdfBackend: 'webcrypto';
      },
    ) => ChainSigner;
    const signer = new ChainSignerWithKdf(
      encryptedPrivateKey,
      password,
      'secp256k1',
      {
        debugCryptoProbeId: CHAIN_SIGNER_PROBE_ID,
        enablePbkdf2Cache: false,
        kdfBackend: 'webcrypto',
      },
    );

    await signer.sign(Buffer.alloc(32, 2));

    expect(
      appCrypto.pbkdf2.getPbkdf2InvocationByProbeId(CHAIN_SIGNER_PROBE_ID)
        ?.backend,
    ).toBe('webcrypto');
  });
});
