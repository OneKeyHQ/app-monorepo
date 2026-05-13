import {
  deriveContextHash,
  parseHexContext,
  validateAppName,
} from './deriveContextHash';

const hex = (h: string) => Uint8Array.from(Buffer.from(h, 'hex'));

// Pinned test pubkey: compressed SEC1 at m/44'/0'/0'/0/0 of the canonical
// "abandon × 11 about" BIP-39 mnemonic. Matches the UniSat v2 conformance vector.
const SPEC_PUBKEY = hex(
  '03aaeb52dd7494c361049de67cc680e83ebcbbbdbeb13637d92cd845f70308af5e',
);

// A second valid compressed pubkey for cross-tests (different parity, different x).
const OTHER_PUBKEY = hex(`02${'11'.repeat(32)}`);

describe('deriveContextHash', () => {
  const APP_NAME = 'test-app';
  const NETWORK = 'bitcoin-mainnet';

  describe('output format', () => {
    it('returns a 64-character lowercase hex string (32 bytes)', () => {
      const ctx = parseHexContext('deadbeef');
      const key = new Uint8Array(32).fill(0xab);
      const result = deriveContextHash(
        key,
        APP_NAME,
        NETWORK,
        SPEC_PUBKEY,
        ctx,
      );
      expect(result).toHaveLength(64);
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('determinism', () => {
    it('produces identical results for the same inputs', () => {
      const ctx = parseHexContext('deadbeef');
      const key = new Uint8Array(32).fill(0xab);
      const a = deriveContextHash(key, APP_NAME, NETWORK, SPEC_PUBKEY, ctx);
      const b = deriveContextHash(key, APP_NAME, NETWORK, SPEC_PUBKEY, ctx);
      expect(a).toBe(b);
    });
  });

  describe('input differentiation', () => {
    const key = new Uint8Array(32).fill(0xab);
    const ctx = parseHexContext('deadbeef');

    it('different contexts produce different outputs', () => {
      const a = deriveContextHash(
        key,
        APP_NAME,
        NETWORK,
        SPEC_PUBKEY,
        parseHexContext('01'),
      );
      const b = deriveContextHash(
        key,
        APP_NAME,
        NETWORK,
        SPEC_PUBKEY,
        parseHexContext('02'),
      );
      expect(a).not.toBe(b);
    });

    it('different appNames produce different outputs', () => {
      const a = deriveContextHash(key, 'app-one', NETWORK, SPEC_PUBKEY, ctx);
      const b = deriveContextHash(key, 'app-two', NETWORK, SPEC_PUBKEY, ctx);
      expect(a).not.toBe(b);
    });

    it('different networks produce different outputs', () => {
      const a = deriveContextHash(
        key,
        APP_NAME,
        'bitcoin-mainnet',
        SPEC_PUBKEY,
        ctx,
      );
      const b = deriveContextHash(
        key,
        APP_NAME,
        'bitcoin-testnet',
        SPEC_PUBKEY,
        ctx,
      );
      const c = deriveContextHash(
        key,
        APP_NAME,
        'bitcoin-signet',
        SPEC_PUBKEY,
        ctx,
      );
      expect(a).not.toBe(b);
      expect(a).not.toBe(c);
      expect(b).not.toBe(c);
    });

    it('different pubkeys produce different outputs', () => {
      const a = deriveContextHash(key, APP_NAME, NETWORK, SPEC_PUBKEY, ctx);
      const b = deriveContextHash(key, APP_NAME, NETWORK, OTHER_PUBKEY, ctx);
      expect(a).not.toBe(b);
    });

    it('different IKM produces different outputs', () => {
      const ikmA = new Uint8Array(32).fill(0xab);
      const ikmB = new Uint8Array(32).fill(0xcd);
      const a = deriveContextHash(ikmA, APP_NAME, NETWORK, SPEC_PUBKEY, ctx);
      const b = deriveContextHash(ikmB, APP_NAME, NETWORK, SPEC_PUBKEY, ctx);
      expect(a).not.toBe(b);
    });

    it('zero-length context is a valid input (variable-length info tail)', () => {
      const empty = parseHexContext('');
      expect(empty.length).toBe(0);
      const out = deriveContextHash(key, APP_NAME, NETWORK, SPEC_PUBKEY, empty);
      expect(out).toMatch(/^[0-9a-f]{64}$/);
      // And must differ from a non-empty context derivation, confirming the
      // empty bytes are actually carried through the HKDF info.
      const nonEmpty = deriveContextHash(
        key,
        APP_NAME,
        NETWORK,
        SPEC_PUBKEY,
        parseHexContext('00'),
      );
      expect(out).not.toBe(nonEmpty);
    });
  });

  describe('input validation', () => {
    const ctx = parseHexContext('deadbeef');
    const key = new Uint8Array(32).fill(0xab);

    it('rejects ikm that is not 32 bytes', () => {
      expect(() =>
        deriveContextHash(
          new Uint8Array(16),
          APP_NAME,
          NETWORK,
          SPEC_PUBKEY,
          ctx,
        ),
      ).toThrow('Input key material must be 32 bytes, got 16');
    });

    it('rejects invalid appName', () => {
      expect(() =>
        deriveContextHash(key, '', NETWORK, SPEC_PUBKEY, ctx),
      ).toThrow('non-empty string');
      expect(() =>
        deriveContextHash(key, 'UPPER', NETWORK, SPEC_PUBKEY, ctx),
      ).toThrow('lowercase');
    });

    it('rejects pubkey that is not 33 bytes', () => {
      const xOnly = new Uint8Array(32).fill(0x42);
      expect(() =>
        deriveContextHash(key, APP_NAME, NETWORK, xOnly, ctx),
      ).toThrow('33 bytes');
    });

    it('rejects pubkey with parity byte other than 0x02 or 0x03', () => {
      const hybrid = new Uint8Array(33);
      hybrid[0] = 0x04;
      expect(() =>
        deriveContextHash(key, APP_NAME, NETWORK, hybrid, ctx),
      ).toThrow('0x02 or 0x03');
    });
  });

  describe('pinned conformance vector', () => {
    // BIP-39 "abandon × 11 about", empty passphrase
    // ikm = BIP-32 private key at m/73681862' (hex):
    const IKM_HEX =
      '391cdb922097ec9c96fc13cadb01d5745ccf31f5dbec3a38103440714779ec85';
    const ikm = Uint8Array.from(Buffer.from(IKM_HEX, 'hex'));

    it('reproduces the pinned vector exactly', () => {
      const result = deriveContextHash(
        ikm,
        'test-app',
        'bitcoin-mainnet',
        SPEC_PUBKEY,
        parseHexContext('deadbeef'),
      );
      expect(result).toBe(
        'f82ced3be0e29591a7863ece03d65f79fb494fe0de7203549855f462455df008',
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

  it('rejects uppercase / spaces / underscores', () => {
    expect(() => validateAppName('Test-App')).toThrow('lowercase');
    expect(() => validateAppName('test app')).toThrow('lowercase');
    expect(() => validateAppName('test_app')).toThrow('lowercase');
  });

  it('rejects > 64 bytes', () => {
    expect(() => validateAppName('a'.repeat(65))).toThrow('64 bytes');
  });

  it('accepts exactly 64 bytes', () => {
    expect(() => validateAppName('a'.repeat(64))).not.toThrow();
  });
});

describe('parseHexContext', () => {
  it('parses valid lowercase hex', () => {
    expect(parseHexContext('deadbeef')).toEqual(
      new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    );
  });

  it('rejects uppercase / mixed case', () => {
    expect(() => parseHexContext('DEADBEEF')).toThrow('lowercase');
    expect(() => parseHexContext('DeAdBeEf')).toThrow('lowercase');
  });

  it('accepts empty (zero-length context is valid in the HKDF info)', () => {
    expect(parseHexContext('')).toEqual(new Uint8Array(0));
  });

  it('rejects odd-length', () => {
    expect(() => parseHexContext('abc')).toThrow('even-length');
  });

  it('rejects 0x prefix', () => {
    expect(() => parseHexContext('0xdeadbeef')).toThrow('0x prefix');
    expect(() => parseHexContext('0Xdeadbeef')).toThrow('0x prefix');
  });

  it('rejects > 2048 hex chars', () => {
    expect(() => parseHexContext('ab'.repeat(1025))).toThrow('2048');
  });

  it('accepts exactly 2048 hex chars', () => {
    expect(() => parseHexContext('ab'.repeat(1024))).not.toThrow();
  });
});
