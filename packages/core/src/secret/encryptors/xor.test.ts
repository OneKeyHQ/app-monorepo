import { xorDecrypt, xorEncrypt } from './xor';

// eslint-disable-next-line spellcheck/spell-checker
// yarn jest packages/core/src/secret/encryptors/xor.test.ts

describe('XOR Encryption and Decryption', () => {
  test('should correctly encrypt and decrypt', () => {
    const originalData = 'Hello, World!';
    const key = 'secretkey';

    const encryptedData = xorEncrypt({
      data: originalData,
      key,
    });

    // originalData not equal encryptedData
    expect(encryptedData).not.toBe(originalData);

    const decryptedData = xorDecrypt({
      encryptedDataHex: encryptedData,
      key,
    });

    expect(decryptedData).toBe(originalData);
  });

  test('should produce different results when encrypting with different keys', () => {
    const data = 'Test data';
    const key1 = 'key1';
    const key2 = 'key2';

    const encrypted1 = xorEncrypt({
      data,
      key: key1,
    });
    const encrypted2 = xorEncrypt({
      data,
      key: key2,
    });

    expect(encrypted1).not.toBe(encrypted2);
  });

  test('should return an empty string when encrypting an empty string', () => {
    const emptyString = '';
    const key = 'anykey';

    const encrypted = xorEncrypt({
      data: emptyString,
      key,
    });
    const decrypted = xorDecrypt({
      encryptedDataHex: encrypted,
      key,
    });

    expect(encrypted).toBe('');
    expect(decrypted).toBe('');
  });

  test('should throw an error when using an empty key', () => {
    const data = 'Some data';
    const emptyKey = '';

    expect(() =>
      xorEncrypt({
        data,
        key: emptyKey,
      }),
    ).toThrow();
    expect(() =>
      xorDecrypt({
        encryptedDataHex: data,
        key: emptyKey,
      }),
    ).toThrow();
  });
});
