import crypto from 'crypto';

import {
  decryptTrezorSuiteLabelFile,
  pickTrezorSuiteAccountLabel,
} from './trezorSuiteLabelDecrypt';

// Mirrors Suite's encrypt(): iv || authTag || ciphertext, hex-encoded.
function encryptLikeTrezorSuite(payload: unknown, keyHex: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(keyHex, 'hex'),
    iv,
  );
  const start = cipher.update(Buffer.from(JSON.stringify(payload), 'utf8'));
  const end = cipher.final();
  return Buffer.concat([iv, cipher.getAuthTag(), start, end]).toString('hex');
}

const KEY = 'c785ef250807166bffc141960c525df97647fcc1bca57f6892ca3742ba86ed8d';
const OTHER_KEY =
  '0f3afcbb17a4bf59f934459135b6fe46136350485e04a4e9472e35050c181c4f';

const decrypt = (fileContent: string, aesKeyHex = KEY) =>
  decryptTrezorSuiteLabelFile({
    fileContent,
    aesKeyHex,
    createDecipheriv: crypto.createDecipheriv as never,
  });

describe('decryptTrezorSuiteLabelFile', () => {
  it('decrypts a file written the way Trezor Suite writes it', () => {
    const content = {
      version: '1.0.0',
      accountLabel: "Bitcoin a'a'a#1",
      outputLabels: {},
      addressLabels: {},
    };
    expect(decrypt(encryptLikeTrezorSuite(content, KEY))).toEqual(content);
  });

  it('tolerates surrounding whitespace', () => {
    const file = encryptLikeTrezorSuite({ accountLabel: 'x' }, KEY);
    expect(decrypt(`\n  ${file}  \n`)).toEqual({ accountLabel: 'x' });
  });

  it('returns undefined for the wrong key instead of throwing', () => {
    const file = encryptLikeTrezorSuite({ accountLabel: 'x' }, KEY);
    expect(decrypt(file, OTHER_KEY)).toBeUndefined();
  });

  it('returns undefined when the payload was tampered with', () => {
    const file = encryptLikeTrezorSuite({ accountLabel: 'x' }, KEY);
    const flipped = `${file.slice(0, -2)}${file.slice(-2) === 'ff' ? '00' : 'ff'}`;
    expect(decrypt(flipped)).toBeUndefined();
  });

  it('rejects malformed input', () => {
    expect(decrypt('')).toBeUndefined();
    expect(decrypt('not-hex')).toBeUndefined();
    expect(decrypt('abc')).toBeUndefined(); // odd length
    expect(decrypt('00'.repeat(20))).toBeUndefined(); // too short for iv+tag
  });

  it('rejects a key that is not 32 bytes', () => {
    const file = encryptLikeTrezorSuite({ accountLabel: 'x' }, KEY);
    expect(decrypt(file, 'abcd')).toBeUndefined();
  });
});

describe('pickTrezorSuiteAccountLabel', () => {
  it('returns a trimmed label', () => {
    expect(pickTrezorSuiteAccountLabel({ accountLabel: '  My BTC  ' })).toBe(
      'My BTC',
    );
  });

  it('ignores empty, missing and oversized labels', () => {
    expect(pickTrezorSuiteAccountLabel(undefined)).toBeUndefined();
    expect(pickTrezorSuiteAccountLabel({})).toBeUndefined();
    expect(pickTrezorSuiteAccountLabel({ accountLabel: '   ' })).toBeUndefined();
    expect(
      pickTrezorSuiteAccountLabel({ accountLabel: 'a'.repeat(81) }),
    ).toBeUndefined();
  });
});
