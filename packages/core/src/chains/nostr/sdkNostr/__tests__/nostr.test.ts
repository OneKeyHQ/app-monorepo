import { decrypt, encrypt } from '..';

describe('Nostr Crypto Functions', () => {
  const testPrivateKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const testPublicKey =
    'a8b5e5163c1d78754dd9229a42047f3ff4b069b99868580da3bb915960e7e9d8';
  const testPlaintext = 'Hello, Nostr!';

  it('should encrypt data with correct format', async () => {
    const encrypted = await encrypt(
      testPrivateKey,
      testPublicKey,
      testPlaintext,
    );
    const [ciphertext, iv] = encrypted.split('?iv=');

    // Validate format
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*\?iv=[A-Za-z0-9+/]+=*$/);

    // Validate IV length (16 bytes)
    const ivBuffer = Buffer.from(iv, 'base64');
    expect(ivBuffer.length).toBe(16);

    // Validate ciphertext is non-empty and base64
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(() => Buffer.from(ciphertext, 'base64')).not.toThrow();
  });

  it('should decrypt encrypted data correctly', async () => {
    const encrypted = await encrypt(
      testPrivateKey,
      testPublicKey,
      testPlaintext,
    );
    const decrypted = await decrypt(testPrivateKey, testPublicKey, encrypted);
    expect(decrypted).toBe(testPlaintext);
  });

  it('should perform round-trip encryption/decryption', async () => {
    const encrypted = await encrypt(
      testPrivateKey,
      testPublicKey,
      testPlaintext,
    );
    const decrypted = await decrypt(testPrivateKey, testPublicKey, encrypted);
    expect(decrypted).toBe(testPlaintext);

    // Verify encrypted data format
    expect(encrypted).toContain('?iv=');
    const [ciphertext, iv] = encrypted.split('?iv=');
    expect(Buffer.from(iv, 'base64').length).toBe(16);
    expect(ciphertext.length).toBeGreaterThan(0);
  });

  it('should generate unique IVs for each encryption', async () => {
    const encrypted1 = await encrypt(
      testPrivateKey,
      testPublicKey,
      testPlaintext,
    );
    const encrypted2 = await encrypt(
      testPrivateKey,
      testPublicKey,
      testPlaintext,
    );

    const [, iv1] = encrypted1.split('?iv=');
    const [, iv2] = encrypted2.split('?iv=');

    // IVs should be different for each encryption
    expect(iv1).not.toBe(iv2);
  });
});
