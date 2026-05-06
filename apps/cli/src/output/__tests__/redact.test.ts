import { createHash } from 'node:crypto';

import { getBip39Fixture } from '../../__test-utils__/bip39-fixtures';
import {
  redactDisplayAddress,
  redactKeyId,
  redactSecret,
  redactSensitiveText,
} from '../redact';

function shortSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

describe('output/redact', () => {
  it('redacts display addresses with an 8+6 visible window', () => {
    expect(redactDisplayAddress('0x1234567890abcdef')).toBe(
      '0x123456...abcdef',
    );
  });

  it('truncates key ids to the first 8 characters', () => {
    expect(redactKeyId('key_123456789abcdef')).toBe('key_1234');
  });

  it('hashes secrets without exposing the original value', () => {
    const secret = 'access-token-super-secret';
    const redacted = redactSecret(secret);

    expect(redacted).toBe(`<REDACTED:sha256:${shortSha256(secret)}>`);
    expect(redacted).not.toContain(secret);
  });

  it('handles short and empty strings without throwing', () => {
    expect(redactDisplayAddress('0xabc')).toBe('0xabc');
    expect(redactKeyId('key')).toBe('key');
    expect(redactSecret('')).toBe(`<REDACTED:sha256:${shortSha256('')}>`);
  });

  it('does not leak BIP-39 fixture words after secret redaction', () => {
    const { mnemonic } = getBip39Fixture(
      'bip39-english-7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
    );
    const redacted = redactSecret(mnemonic);

    expect(redacted).toBe(`<REDACTED:sha256:${shortSha256(mnemonic)}>`);
    for (const word of mnemonic.split(' ')) {
      expect(redacted).not.toContain(word);
    }
  });

  it('redacts sensitive substrings in free-form text', () => {
    const privateKey = `0x${'a'.repeat(64)}`;
    const bearerToken = 'access-token-super-secret';
    const redacted = redactSensitiveText(
      `key=${privateKey} Authorization: Bearer ${bearerToken}`,
    );

    expect(redacted).not.toContain(privateKey);
    expect(redacted).not.toContain(bearerToken);
    expect(redacted).toContain('<REDACTED:sha256:');
  });
});
