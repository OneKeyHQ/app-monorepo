import { decrypt, encrypt } from '../index';

describe('Nostr Crypto Functions', () => {
  const testPrivateKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const testPublicKey =
    'a8b5e5163c1d78754dd9229a42047f3ff4b069b99868580da3bb915960e7e9d8';
  const testPlaintext = 'Hello, Nostr!';

  it('should match snapshot for encryption', async () => {
    const encrypted = await encrypt(
      testPrivateKey,
      testPublicKey,
      testPlaintext,
    );
    // Convert base64 parts to hex for consistent snapshots
    const [ciphertext, iv] = encrypted.split('?iv=');
    const ciphertextBuffer = Buffer.from(ciphertext, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    expect({
      ciphertext: ciphertextBuffer.toString('hex'),
      iv: ivBuffer.toString('hex'),
    }).toMatchSnapshot();
  });

  it('should match snapshot for decryption', async () => {
    const encrypted = await encrypt(
      testPrivateKey,
      testPublicKey,
      testPlaintext,
    );
    const decrypted = await decrypt(testPrivateKey, testPublicKey, encrypted);
    // Convert UTF-8 string to hex for consistent snapshots
    expect(Buffer.from(decrypted).toString('hex')).toMatchSnapshot();
  });

  it('should match snapshot for round-trip encryption/decryption', async () => {
    const encrypted = await encrypt(
      testPrivateKey,
      testPublicKey,
      testPlaintext,
    );
    const decrypted = await decrypt(testPrivateKey, testPublicKey, encrypted);
    expect({
      input: Buffer.from(testPlaintext).toString('hex'),
      output: Buffer.from(decrypted).toString('hex'),
    }).toMatchSnapshot();
  });

  it('should validate encryption format', async () => {
    const encrypted = await encrypt(
      testPrivateKey,
      testPublicKey,
      testPlaintext,
    );
    const [ciphertext, iv] = encrypted.split('?iv=');

    // Validate format and convert to hex for snapshot
    expect({
      format: 'base64+iv',
      ciphertext: Buffer.from(ciphertext, 'base64').toString('hex'),
      iv: Buffer.from(iv, 'base64').toString('hex'),
      hasValidFormat:
        encrypted.match(/^[A-Za-z0-9+/]+=*\?iv=[A-Za-z0-9+/]+=*$/) !== null,
    }).toMatchSnapshot();
  });
});
