import { decrypt, encrypt, secureWipe } from '../core/crypto-utils';

describe('crypto-utils', () => {
  it('encrypts and decrypts round-trip', async () => {
    const plaintext = Buffer.from('test mnemonic phrase');
    const password = 'test-password';
    const encrypted = await encrypt(plaintext, password);
    const decrypted = await decrypt(encrypted, password);
    expect(decrypted.toString('utf-8')).toBe('test mnemonic phrase');
  });

  it('fails decryption with wrong password', async () => {
    const plaintext = Buffer.from('secret data');
    const encrypted = await encrypt(plaintext, 'correct-password');
    await expect(decrypt(encrypted, 'wrong-password')).rejects.toThrow();
  });

  it('produces different ciphertext each time', async () => {
    const plaintext = Buffer.from('same input');
    const password = 'same-password';
    const a = await encrypt(plaintext, password);
    const b = await encrypt(plaintext, password);
    expect(a.equals(b)).toBe(false);
  });

  it('rejects truncated ciphertext', async () => {
    const short = Buffer.alloc(10);
    await expect(decrypt(short, 'password')).rejects.toThrow();
  });

  it('secureWipe fills buffer with zeros', () => {
    const buf = Buffer.from('sensitive');
    secureWipe(buf);
    expect(buf.every((b) => b === 0)).toBe(true);
  });
});
