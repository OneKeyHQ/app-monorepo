import { parseSecretRecoveryPhrase } from './phrase';

describe('parseSecretRecoveryPhrase', () => {
  it('should handle a regular Secret Recovery Phrase', () => {
    expect(parseSecretRecoveryPhrase('foo bar baz')).toStrictEqual(
      'foo bar baz',
    );
  });

  it('should handle a mixed-case Secret Recovery Phrase', () => {
    expect(parseSecretRecoveryPhrase('FOO bAr baZ')).toStrictEqual(
      'foo bar baz',
    );
  });

  it('should handle an upper-case Secret Recovery Phrase', () => {
    expect(parseSecretRecoveryPhrase('FOO BAR BAZ')).toStrictEqual(
      'foo bar baz',
    );
  });

  it('should trim extraneous whitespace from the given Secret Recovery Phrase', () => {
    expect(parseSecretRecoveryPhrase('  foo   bar   baz  ')).toStrictEqual(
      'foo bar baz',
    );
  });

  it('should handle tabs in the Secret Recovery Phrase', () => {
    expect(parseSecretRecoveryPhrase('foo\tbar\tbaz')).toStrictEqual(
      'foo bar baz',
    );
  });

  it('should handle a combination of tabs, spaces, and newlines in the Secret Recovery Phrase', () => {
    expect(parseSecretRecoveryPhrase('foo\t \nbar\t\r\n baz')).toStrictEqual(
      'foo bar baz',
    );
  });

  it('should handle newlines in the Secret Recovery Phrase', () => {
    expect(parseSecretRecoveryPhrase('foo\nbar\nbaz')).toStrictEqual(
      'foo bar baz',
    );
    expect(parseSecretRecoveryPhrase('foo\r\nbar\r\nbaz')).toStrictEqual(
      'foo bar baz',
    );
  });

  it('should return an empty string when given a whitespace-only string', () => {
    expect(parseSecretRecoveryPhrase('   ')).toStrictEqual('');
  });

  it('should return an empty string when given a string with only symbols', () => {
    expect(parseSecretRecoveryPhrase('$')).toStrictEqual('');
  });

  it('should return an empty string for both null and undefined', () => {
    expect(
      parseSecretRecoveryPhrase(undefined as unknown as string),
    ).toStrictEqual('');
    expect(parseSecretRecoveryPhrase(null as unknown as string)).toStrictEqual(
      '',
    );
  });
});
