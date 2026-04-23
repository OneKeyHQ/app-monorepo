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
});
