import { decodeAssuanData, parsePinentryStdout } from '../utils/pinentry';

describe('decodeAssuanData', () => {
  it('passes plain ASCII through unchanged', () => {
    expect(decodeAssuanData('hello-world')).toBe('hello-world');
  });

  it('decodes a literal percent (%25 → %)', () => {
    // pinentry sends `D a%25b%25c` for the user input `a%b%c`
    expect(decodeAssuanData('a%25b%25c')).toBe('a%b%c');
  });

  it('decodes CR (%0D) and LF (%0A)', () => {
    expect(decodeAssuanData('line1%0Dline2%0Aline3')).toBe(
      'line1\rline2\nline3',
    );
  });

  it('handles trailing percent encoding', () => {
    expect(decodeAssuanData('end%25')).toBe('end%');
  });

  it('handles uppercase and lowercase hex', () => {
    expect(decodeAssuanData('%2a%2A')).toBe('**');
  });

  it('leaves a bare % (not followed by 2 hex chars) untouched', () => {
    // pinentry never produces this, but the decoder must not corrupt it.
    expect(decodeAssuanData('100%')).toBe('100%');
    expect(decodeAssuanData('%2')).toBe('%2');
    expect(decodeAssuanData('%zz')).toBe('%zz');
  });

  it('leaves an empty string alone', () => {
    expect(decodeAssuanData('')).toBe('');
  });

  // Assuan only percent-encodes %, CR, and LF. Every other byte — including
  // multi-byte UTF-8 sequences, extended ASCII, spaces, symbols — goes over
  // the D line untouched. These tests mirror the real passphrases exercised
  // by hardware-js-sdk expo-example/TestSpecialPassphraseWallet, so a
  // decoder change that accidentally mangles non-ASCII input fails here
  // instead of only in a hardware-required integration run.
  it('passes UTF-8 multi-byte scripts through unchanged', () => {
    expect(decodeAssuanData('你好passphrase')).toBe('你好passphrase');
    expect(decodeAssuanData('私のパスワード')).toBe('私のパスワード');
    expect(decodeAssuanData('myسياسةpassphrase')).toBe('myسياسةpassphrase');
  });

  it('passes extended ASCII and accented chars unchanged', () => {
    expect(decodeAssuanData('¥Øÿ')).toBe('¥Øÿ');
    expect(decodeAssuanData('P@sswôrd€')).toBe('P@sswôrd€');
    expect(decodeAssuanData('mi política de frase de contraseña')).toBe(
      'mi política de frase de contraseña',
    );
  });

  it('preserves leading and trailing spaces', () => {
    // Regression guard: a .trim() added "defensively" anywhere in the pipe
    // would derive the wrong passphraseState for a padded passphrase and
    // silently unlock a different hidden wallet.
    expect(decodeAssuanData(' My Passphrase ')).toBe(' My Passphrase ');
  });

  it('passes a multi-script mixed passphrase through unchanged', () => {
    // The "everything all at once" case — multiple Unicode scripts plus
    // punctuation — mirrors hardware-js-sdk Wallet-1.
    const mixed = 'Aa0!)_+맪Ӎ¬}¨¥ϸΔѭЧゞく6鼵';
    expect(decodeAssuanData(mixed)).toBe(mixed);
  });
});

describe('parsePinentryStdout', () => {
  // Captured from a real pinentry-mac run earlier in this branch.
  it('parses a real pinentry-mac success response', () => {
    const stdout =
      'OK Pleased to meet you, process 38946\nOK\nOK\nD a%25b%25c\nOK\n';
    expect(parsePinentryStdout(stdout)).toEqual({
      data: 'a%b%c',
      cancelled: false,
    });
  });

  it('returns no data and cancelled=false when user clicks OK on empty', () => {
    // Pinentry omits the D line entirely when the input is empty.
    const stdout = 'OK Pleased to meet you\nOK\nOK\nOK\n';
    expect(parsePinentryStdout(stdout)).toEqual({ cancelled: false });
  });

  it('flags cancellation via ERR 83886179', () => {
    const stdout =
      'OK Pleased to meet you\nOK\nOK\nERR 83886179 Operation cancelled\n';
    expect(parsePinentryStdout(stdout)).toEqual({ cancelled: true });
  });

  it('concatenates multi-line D responses before decoding', () => {
    // User typed `first-half-with-%-end` (literal `%`). Pinentry encoded
    // `%` as `%25` and the line-length limit happened to split right inside
    // that triple — `%2` ends line 1, `5` starts line 2. We must concat
    // raw chunks *first*, then decode — otherwise `%2` alone is not a
    // valid `%XX` triple and the `%` would be permanently lost.
    const stdout = ['OK', 'D first-half-with-%2', 'D 5-end', 'OK'].join('\n');
    expect(parsePinentryStdout(stdout)).toEqual({
      data: 'first-half-with-%-end',
      cancelled: false,
    });
  });

  it('also concatenates D chunks that do not split inside %XX', () => {
    const stdout = ['OK', 'D part-one-', 'D part-two', 'OK'].join('\n');
    expect(parsePinentryStdout(stdout)).toEqual({
      data: 'part-one-part-two',
      cancelled: false,
    });
  });

  it('handles CRLF line endings (pinentry-gnome3/qt)', () => {
    const stdout = 'OK Pleased\r\nOK\r\nOK\r\nD secret%25here\r\nOK\r\n';
    expect(parsePinentryStdout(stdout)).toEqual({
      data: 'secret%here',
      cancelled: false,
    });
  });

  it('decodes CR/LF inside the passphrase (theoretical)', () => {
    const stdout = 'OK\nD line1%0Dline2%0Aline3\nOK\n';
    expect(parsePinentryStdout(stdout)).toEqual({
      data: 'line1\rline2\nline3',
      cancelled: false,
    });
  });

  // End-to-end sanity over a full stdout frame carrying the real-world
  // passphrases exercised by hardware-js-sdk expo-example. Guards the
  // `D ` prefix strip (`.slice(2)`) against any future refactor that would
  // drop a byte from the leading space (e.g. switching to `.slice(1).trimStart()`).
  it('parses a stdout frame carrying a UTF-8 passphrase', () => {
    const stdout = 'OK Pleased to meet you\nOK\nOK\nD 你好passphrase\nOK\n';
    expect(parsePinentryStdout(stdout)).toEqual({
      data: '你好passphrase',
      cancelled: false,
    });
  });

  it('parses a stdout frame with surrounding spaces in the passphrase', () => {
    const stdout = 'OK\nOK\nOK\nD  My Passphrase \nOK\n';
    expect(parsePinentryStdout(stdout)).toEqual({
      data: ' My Passphrase ',
      cancelled: false,
    });
  });

  it('parses a stdout frame with a mixed-script passphrase', () => {
    const stdout = 'OK\nD Aa0!)_+맪Ӎ¬}¨¥ϸΔѭЧゞく6鼵\nOK\n';
    expect(parsePinentryStdout(stdout)).toEqual({
      data: 'Aa0!)_+맪Ӎ¬}¨¥ϸΔѭЧゞく6鼵',
      cancelled: false,
    });
  });
});
