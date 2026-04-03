import { sanitize } from '../utils/logger';

describe('sanitize', () => {
  it('redacts 64-char hex private keys', () => {
    const key = `0x${'a'.repeat(64)}`;
    expect(sanitize(`key: ${key}`)).toBe('key: [REDACTED]');
  });

  it('does not redact shorter hex strings', () => {
    const short = `0x${'a'.repeat(40)}`;
    expect(sanitize(`addr: ${short}`)).toBe(`addr: ${short}`);
  });

  it('redacts 12-word mnemonic phrases', () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(sanitize(`seed: ${mnemonic}`)).toBe('seed: [REDACTED]');
  });

  it('redacts 24-word mnemonic phrases', () => {
    const words = Array(24).fill('abandon').join(' ');
    expect(sanitize(`seed: ${words}`)).toBe('seed: [REDACTED]');
  });

  it('does not redact normal text', () => {
    const text = 'Transfer 1.5 ETH to 0xabc';
    expect(sanitize(text)).toBe(text);
  });
});
