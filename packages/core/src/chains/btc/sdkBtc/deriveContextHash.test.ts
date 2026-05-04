import {
  deriveContextHash,
  parseHexContext,
  validateAppName,
} from './deriveContextHash';

describe('deriveContextHash', () => {
  const APP_NAME = 'test-app';

  describe('output format', () => {
    it('returns a 64-character hex string (32 bytes)', () => {
      const ctx = parseHexContext('deadbeef');
      const key = new Uint8Array(32).fill(0xab);
      const result = deriveContextHash(key, APP_NAME, ctx);
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('determinism', () => {
    it('produces identical results for same key + appName + context', () => {
      const ctx = parseHexContext('deadbeef');
      const key = new Uint8Array(32).fill(0xab);
      const a = deriveContextHash(key, APP_NAME, ctx);
      const b = deriveContextHash(key, APP_NAME, ctx);
      expect(a).toBe(b);
    });
  });

  describe('domain separation', () => {
    it('produces different results for different contexts', () => {
      const key = new Uint8Array(32).fill(0xab);
      const a = deriveContextHash(key, APP_NAME, parseHexContext('01'));
      const b = deriveContextHash(key, APP_NAME, parseHexContext('02'));
      expect(a).not.toBe(b);
    });

    it('produces different results for different appNames', () => {
      const key = new Uint8Array(32).fill(0xab);
      const ctx = parseHexContext('deadbeef');
      const a = deriveContextHash(key, 'app-one', ctx);
      const b = deriveContextHash(key, 'app-two', ctx);
      expect(a).not.toBe(b);
    });
  });

  describe('input validation', () => {
    it('rejects key material that is not 32 bytes', () => {
      const ctx = parseHexContext('deadbeef');
      expect(() =>
        deriveContextHash(new Uint8Array(16), APP_NAME, ctx),
      ).toThrow('Input key material must be 32 bytes, got 16');
      expect(() =>
        deriveContextHash(new Uint8Array(64), APP_NAME, ctx),
      ).toThrow('Input key material must be 32 bytes, got 64');
    });

    it('rejects invalid appName', () => {
      const key = new Uint8Array(32).fill(0xab);
      const ctx = parseHexContext('deadbeef');
      expect(() => deriveContextHash(key, '', ctx)).toThrow('non-empty string');
      expect(() => deriveContextHash(key, 'UPPER', ctx)).toThrow(
        'lowercase letters, digits, and hyphens',
      );
      expect(() => deriveContextHash(key, 'has space', ctx)).toThrow(
        'lowercase letters, digits, and hyphens',
      );
    });

    it('rejects empty context bytes', () => {
      const key = new Uint8Array(32).fill(0xab);
      expect(() => deriveContextHash(key, APP_NAME, new Uint8Array(0))).toThrow(
        'context must be non-empty',
      );
    });

    it('rejects context bytes exceeding 1024 bytes', () => {
      const key = new Uint8Array(32).fill(0xab);
      expect(() =>
        deriveContextHash(key, APP_NAME, new Uint8Array(1025)),
      ).toThrow('context must not exceed 1024 bytes');
    });

    it('accepts context of exactly 1024 bytes', () => {
      const key = new Uint8Array(32).fill(0xab);
      expect(() =>
        deriveContextHash(key, APP_NAME, new Uint8Array(1024)),
      ).not.toThrow();
    });
  });

  // Known-answer vectors. Any conforming implementation MUST produce these
  // exact outputs for the given inputs — that's the cross-wallet interop
  // guarantee. IKM is the BIP-32 private key at m/73681862' derived from
  // the standard BIP-39 mnemonic "abandon abandon abandon abandon abandon
  // abandon abandon abandon abandon abandon abandon about" (no passphrase).
  describe('known-answer tests (cross-wallet interop vectors)', () => {
    const IKM_HEX =
      '391cdb922097ec9c96fc13cadb01d5745ccf31f5dbec3a38103440714779ec85';
    const ikm = new Uint8Array(Buffer.from(IKM_HEX, 'hex'));

    it('vector 1: context=deadbeef', () => {
      const result = deriveContextHash(
        ikm,
        'test-app',
        parseHexContext('deadbeef'),
      );
      expect(result).toBe(
        '3b0e2d90a01122eed8a520648073892f6b2d8f4419216023d63cdbd49500fca3',
      );
    });

    it('vector 2: context=00', () => {
      const result = deriveContextHash(ikm, 'test-app', parseHexContext('00'));
      expect(result).toBe(
        '50775126782c1a5e4d60daa4666b2c7590f0b5a445a4115b0abd411467c92597',
      );
    });

    it('vector 3: context=64 zero bytes', () => {
      const context128zeros = '00'.repeat(64);
      const result = deriveContextHash(
        ikm,
        'test-app',
        parseHexContext(context128zeros),
      );
      expect(result).toBe(
        'd81e4a91f32eabd34df0e55ca36f26f211af65dfe575b7201c95baaa6608cdd9',
      );
    });
  });
});

describe('validateAppName', () => {
  it('accepts valid appNames', () => {
    expect(() => validateAppName('test-app')).not.toThrow();
    expect(() => validateAppName('a')).not.toThrow();
    expect(() => validateAppName('a-b-c-123')).not.toThrow();
  });

  it('rejects empty', () => {
    expect(() => validateAppName('')).toThrow('non-empty string');
  });

  it('rejects uppercase', () => {
    expect(() => validateAppName('Test-App')).toThrow(
      'lowercase letters, digits, and hyphens',
    );
  });

  it('rejects spaces', () => {
    expect(() => validateAppName('test app')).toThrow(
      'lowercase letters, digits, and hyphens',
    );
  });

  it('rejects underscores', () => {
    expect(() => validateAppName('test_app')).toThrow(
      'lowercase letters, digits, and hyphens',
    );
  });

  it('rejects > 64 bytes', () => {
    const longName = 'a'.repeat(65);
    expect(() => validateAppName(longName)).toThrow('64 bytes');
  });

  it('accepts exactly 64 bytes', () => {
    const name64 = 'a'.repeat(64);
    expect(() => validateAppName(name64)).not.toThrow();
  });
});

describe('parseHexContext', () => {
  it('parses valid lowercase hex string', () => {
    const result = parseHexContext('deadbeef');
    expect(result).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
  });

  it('rejects uppercase hex', () => {
    expect(() => parseHexContext('DEADBEEF')).toThrow('lowercase hex');
  });

  it('rejects mixed case hex', () => {
    expect(() => parseHexContext('DeAdBeEf')).toThrow('lowercase hex');
  });

  it('rejects empty string', () => {
    expect(() => parseHexContext('')).toThrow('non-empty');
  });

  it('rejects odd-length hex', () => {
    expect(() => parseHexContext('abc')).toThrow('even-length');
  });

  it('rejects non-hex characters', () => {
    expect(() => parseHexContext('xyz123')).toThrow('lowercase hex');
  });

  it('rejects 0x prefix', () => {
    expect(() => parseHexContext('0xdeadbeef')).toThrow('0x prefix');
  });

  it('rejects 0X prefix', () => {
    expect(() => parseHexContext('0Xdeadbeef')).toThrow('0x prefix');
  });

  it('rejects context exceeding 2048 hex chars', () => {
    const longHex = 'ab'.repeat(1025);
    expect(() => parseHexContext(longHex)).toThrow('2048');
  });

  it('accepts context of exactly 2048 hex chars', () => {
    const maxHex = 'ab'.repeat(1024);
    expect(() => parseHexContext(maxHex)).not.toThrow();
  });
});
