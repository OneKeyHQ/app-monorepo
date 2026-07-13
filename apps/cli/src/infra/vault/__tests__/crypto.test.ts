import {
  decryptVault,
  deriveHkdfKey,
  deriveVaultKey,
  encryptVault,
} from '../crypto';

import type { IHkdfHash } from '../crypto';

function fromHex(hex: string): Buffer {
  return Buffer.from(hex.replace(/\s+/gu, ''), 'hex');
}

const RFC_5869_VECTORS: Array<{
  id: string;
  hash: IHkdfHash;
  ikm: Buffer;
  salt: Buffer;
  info: Buffer;
  length: number;
  okm: Buffer;
}> = [
  {
    id: 'A.1 SHA-256 basic',
    hash: 'sha256',
    ikm: Buffer.alloc(22, 0x0b),
    salt: fromHex('000102030405060708090a0b0c'),
    info: fromHex('f0f1f2f3f4f5f6f7f8f9'),
    length: 42,
    okm: fromHex(`
      3cb25f25faacd57a90434f64d0362f2a
      2d2d0a90cf1a5a4c5db02d56ecc4c5bf
      34007208d5b887185865
    `),
  },
  {
    id: 'A.2 SHA-256 long',
    hash: 'sha256',
    ikm: fromHex(`
      000102030405060708090a0b0c0d0e0f
      101112131415161718191a1b1c1d1e1f
      202122232425262728292a2b2c2d2e2f
      303132333435363738393a3b3c3d3e3f
      404142434445464748494a4b4c4d4e4f
    `),
    salt: fromHex(`
      606162636465666768696a6b6c6d6e6f
      707172737475767778797a7b7c7d7e7f
      808182838485868788898a8b8c8d8e8f
      909192939495969798999a9b9c9d9e9f
      a0a1a2a3a4a5a6a7a8a9aaabacadaeaf
    `),
    info: fromHex(`
      b0b1b2b3b4b5b6b7b8b9babbbcbdbebf
      c0c1c2c3c4c5c6c7c8c9cacbcccdcecf
      d0d1d2d3d4d5d6d7d8d9dadbdcdddedf
      e0e1e2e3e4e5e6e7e8e9eaebecedeeef
      f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff
    `),
    length: 82,
    okm: fromHex(`
      b11e398dc80327a1c8e7f78c596a4934
      4f012eda2d4efad8a050cc4c19afa97c
      59045a99cac7827271cb41c65e590e09
      da3275600c2f09b8367793a9aca3db71
      cc30c58179ec3e87c14c01d5c1f3434f
      1d87
    `),
  },
  {
    id: 'A.3 SHA-256 empty salt and info',
    hash: 'sha256',
    ikm: Buffer.alloc(22, 0x0b),
    salt: Buffer.alloc(0),
    info: Buffer.alloc(0),
    length: 42,
    okm: fromHex(`
      8da4e775a563c18f715f802a063c5a31
      b8a11f5c5ee1879ec3454e5f3c738d2d
      9d201395faa4b61a96c8
    `),
  },
  {
    id: 'A.4 SHA-1 basic',
    hash: 'sha1',
    ikm: Buffer.alloc(11, 0x0b),
    salt: fromHex('000102030405060708090a0b0c'),
    info: fromHex('f0f1f2f3f4f5f6f7f8f9'),
    length: 42,
    okm: fromHex(`
      085a01ea1b10f36933068b56efa5ad81
      a4f14b822f5b091568a9cdd4f155fda2
      c22e422478d305f3f896
    `),
  },
  {
    id: 'A.5 SHA-1 long',
    hash: 'sha1',
    ikm: fromHex(`
      000102030405060708090a0b0c0d0e0f
      101112131415161718191a1b1c1d1e1f
      202122232425262728292a2b2c2d2e2f
      303132333435363738393a3b3c3d3e3f
      404142434445464748494a4b4c4d4e4f
    `),
    salt: fromHex(`
      606162636465666768696a6b6c6d6e6f
      707172737475767778797a7b7c7d7e7f
      808182838485868788898a8b8c8d8e8f
      909192939495969798999a9b9c9d9e9f
      a0a1a2a3a4a5a6a7a8a9aaabacadaeaf
    `),
    info: fromHex(`
      b0b1b2b3b4b5b6b7b8b9babbbcbdbebf
      c0c1c2c3c4c5c6c7c8c9cacbcccdcecf
      d0d1d2d3d4d5d6d7d8d9dadbdcdddedf
      e0e1e2e3e4e5e6e7e8e9eaebecedeeef
      f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff
    `),
    length: 82,
    okm: fromHex(`
      0bd770a74d1160f7c9f12cd5912a06eb
      ff6adcae899d92191fe4305673ba2ffe
      8fa3f1a4e5ad79f3f334b3b202b2173c
      486ea37ce3d397ed034c7f9dfeb15c5e
      927336d0441f4c4300e2cff0d0900b52
      d3b4
    `),
  },
];

describe('vault crypto', () => {
  it.each(RFC_5869_VECTORS)('matches RFC 5869 vector $id', (vector) => {
    expect(
      deriveHkdfKey({
        hash: vector.hash,
        inputKeyMaterial: vector.ikm,
        salt: vector.salt,
        info: vector.info,
        length: vector.length,
      }),
    ).toEqual(vector.okm);
  });

  it('derives deterministic vault keys with the expected length', () => {
    const masterKey = Buffer.alloc(32, 0x11);

    expect(deriveVaultKey(masterKey)).toEqual(deriveVaultKey(masterKey));
    expect(deriveVaultKey(masterKey)).toHaveLength(32);
  });

  it('separates HKDF info domains', () => {
    const masterKey = Buffer.alloc(32, 0x22);
    const salt = Buffer.alloc(32, 0);
    const left = deriveHkdfKey({
      hash: 'sha256',
      inputKeyMaterial: masterKey,
      salt,
      info: 'bot-wallet/vault/v1',
      length: 32,
    });
    const right = deriveHkdfKey({
      hash: 'sha256',
      inputKeyMaterial: masterKey,
      salt,
      info: 'bot-wallet/other/v1',
      length: 32,
    });

    expect(left).not.toEqual(right);
  });

  it('roundtrips AES-256-GCM ciphertext', () => {
    const vaultKey = deriveVaultKey(Buffer.alloc(32, 0x33));
    const aad = Buffer.from('OKVAULT101', 'utf8');
    const plaintext = Buffer.from('vault plaintext');

    const encrypted = encryptVault(plaintext, vaultKey, aad);

    expect(
      decryptVault(encrypted.nonce, encrypted.ciphertextWithTag, vaultKey, aad),
    ).toEqual(plaintext);
  });

  it('rejects ciphertext tampering', () => {
    const vaultKey = deriveVaultKey(Buffer.alloc(32, 0x44));
    const aad = Buffer.from('aad');
    const encrypted = encryptVault(Buffer.from('plaintext'), vaultKey, aad);
    const tampered = Buffer.from(encrypted.ciphertextWithTag);
    tampered[0] = tampered[0] === 0 ? 1 : 0;

    expect(() =>
      decryptVault(encrypted.nonce, tampered, vaultKey, aad),
    ).toThrow();
  });

  it('rejects AAD tampering', () => {
    const vaultKey = deriveVaultKey(Buffer.alloc(32, 0x55));
    const encrypted = encryptVault(
      Buffer.from('plaintext'),
      vaultKey,
      Buffer.from('aad'),
    );

    expect(() =>
      decryptVault(
        encrypted.nonce,
        encrypted.ciphertextWithTag,
        vaultKey,
        Buffer.from('bad'),
      ),
    ).toThrow();
  });

  it('rejects nonce tampering', () => {
    const vaultKey = deriveVaultKey(Buffer.alloc(32, 0x66));
    const aad = Buffer.from('aad');
    const encrypted = encryptVault(Buffer.from('plaintext'), vaultKey, aad);
    const nonce = Buffer.from(encrypted.nonce);
    nonce[0] = nonce[0] === 0 ? 1 : 0;

    expect(() =>
      decryptVault(nonce, encrypted.ciphertextWithTag, vaultKey, aad),
    ).toThrow();
  });

  it('uses unique nonces across repeated encryptions', () => {
    const vaultKey = deriveVaultKey(Buffer.alloc(32, 0x77));
    const aad = Buffer.from('aad');
    const nonces = new Set<string>();

    for (let index = 0; index < 100; index += 1) {
      nonces.add(
        encryptVault(Buffer.from('plaintext'), vaultKey, aad).nonce.toString(
          'hex',
        ),
      );
    }

    expect(nonces.size).toBe(100);
  });
});
