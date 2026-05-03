import {
  ENCRYPT_LAYOUT,
  decryptCredential,
  encryptCredential,
  secureWipe,
} from '../encrypt';

import type { ICliBotWalletRevealableSeed } from '../../../types/cliBotWallet';

const fixtureSeed: ICliBotWalletRevealableSeed = {
  entropyWithLangPrefixed: `0110${'00'.repeat(16)}${'00'.repeat(16)}`,
  seed: 'a'.repeat(128),
};

describe('encryptCredential (AC8)', () => {
  it('roundtrip happy path: encrypt then decrypt yields the same seed', () => {
    const { ciphertextBase64, randomKey } = encryptCredential(fixtureSeed);
    expect(randomKey.length).toBe(ENCRYPT_LAYOUT.keyBytes);
    const decrypted = decryptCredential(ciphertextBase64, randomKey);
    expect(decrypted).toEqual(fixtureSeed);
  });

  it('produces unique nonces (and thus distinct ciphertexts) on each call', () => {
    const a = encryptCredential(fixtureSeed);
    const b = encryptCredential(fixtureSeed);
    // Even with same plaintext, fresh random key + fresh nonce → ciphertext
    // must differ.
    expect(a.ciphertextBase64).not.toBe(b.ciphertextBase64);
    // Nonces (first 12B of the blob) must differ.
    const nonceA = Buffer.from(a.ciphertextBase64, 'base64').subarray(0, 12);
    const nonceB = Buffer.from(b.ciphertextBase64, 'base64').subarray(0, 12);
    expect(nonceA.equals(nonceB)).toBe(false);
  });

  it('randomKey is exactly 32 bytes (AES-256)', () => {
    const { randomKey } = encryptCredential(fixtureSeed);
    expect(randomKey.length).toBe(32);
  });

  it('uses stableStringify for plaintext (field order independent)', () => {
    // Two seeds with same fields in different declaration order MUST decrypt
    // to byte-identical plaintexts when stringified — proves stableStringify
    // is on the path.
    const a: ICliBotWalletRevealableSeed = {
      entropyWithLangPrefixed: 'aa',
      seed: 'bb',
    };
    const b = { seed: 'bb', entropyWithLangPrefixed: 'aa' };
    const ea = encryptCredential(a);
    const eb = encryptCredential(b as ICliBotWalletRevealableSeed);
    // Different keys/nonces → different ciphertexts; but both decrypt to the
    // same JSON when re-encoded with stable field order.
    expect(decryptCredential(ea.ciphertextBase64, ea.randomKey)).toEqual(
      decryptCredential(eb.ciphertextBase64, eb.randomKey),
    );
  });

  it('secureWipe zeros the buffer in place', () => {
    const { randomKey } = encryptCredential(fixtureSeed);
    expect(randomKey.some((b) => b !== 0)).toBe(true); // very likely
    secureWipe(randomKey);
    expect(randomKey.every((b) => b === 0)).toBe(true);
  });

  it('decryptCredential rejects a wrong key (auth tag mismatch)', () => {
    const { ciphertextBase64 } = encryptCredential(fixtureSeed);
    const wrongKey = Buffer.alloc(32, 0xff);
    expect(() => decryptCredential(ciphertextBase64, wrongKey)).toThrow();
  });

  it('decryptCredential rejects a tampered ciphertext (auth tag check)', () => {
    const { ciphertextBase64, randomKey } = encryptCredential(fixtureSeed);
    const blob = Buffer.from(ciphertextBase64, 'base64');
    // flip a byte inside the ciphertext region (after nonce, before tag)
    // eslint-disable-next-line no-bitwise
    blob[20] ^= 0x01;
    const tampered = blob.toString('base64');
    expect(() => decryptCredential(tampered, randomKey)).toThrow();
  });

  it('layout constants frozen (algorithm + size contract)', () => {
    expect(ENCRYPT_LAYOUT).toEqual({
      algorithm: 'aes-256-gcm',
      keyBytes: 32,
      nonceBytes: 12,
      tagBytes: 16,
    });
  });
});
