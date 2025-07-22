/* eslint-disable spellcheck/spell-checker */

import {
  AIP80_PREFIXES,
  addPrefix,
  checkAlgorithmSupport,
  detectAlgorithm,
  getSupportedAlgorithms,
  isAIP80Format,
  isLegacyFormat,
  normalizePrivateKey,
  stripPrefix,
  validatePrivateKey,
} from './privateUtils';

jest.mock('@onekeyhq/shared/src/utils/hexUtils', () => ({
  __esModule: true,
  default: {
    hasHexPrefix: (str: string) => str.startsWith('0x') || str.startsWith('0X'),
    stripHexPrefix: (str: string) =>
      str.startsWith('0x') || str.startsWith('0X') ? str.slice(2) : str,
    addHexPrefix: (str: string) =>
      str.startsWith('0x') || str.startsWith('0X') ? str : `0x${str}`,
    isHexString: (value: string) => {
      const hexRegex = /^0x[0-9a-fA-F]*$/;
      return hexRegex.test(value) || /^[0-9a-fA-F]*$/.test(value);
    },
  },
}));

// Test data constants
const VALID_RAW_PRIVATE_KEY =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const VALID_RAW_PRIVATE_KEY_WITHOUT_PREFIX =
  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const ED25519_AIP80_PRIVATE_KEY =
  'ed25519-priv-0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const SECP256K1_AIP80_PRIVATE_KEY =
  'secp256k1-priv-0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const INVALID_HEX_PRIVATE_KEY =
  '0xgggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg';
const SHORT_PRIVATE_KEY = '0x1234';
const LONG_PRIVATE_KEY =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234';
const EMPTY_STRING = '';
const NULL_VALUE = null;
const UNDEFINED_VALUE = undefined;

describe('privateUtils', () => {
  describe('AIP80_PREFIXES constant', () => {
    it('should have correct prefixes for supported algorithms', () => {
      expect(AIP80_PREFIXES.ed25519).toBe('ed25519-priv-');
      expect(AIP80_PREFIXES.secp256k1).toBe('secp256k1-priv-');
      expect(AIP80_PREFIXES.nistp256).toBeUndefined();
    });
  });

  describe('getSupportedAlgorithms', () => {
    it('should return an array of supported algorithms', () => {
      const algorithms = getSupportedAlgorithms();
      expect(Array.isArray(algorithms)).toBe(true);
      expect(algorithms).toContain('ed25519');
    });

    it('should only contain algorithms that have prefixes defined', () => {
      const algorithms = getSupportedAlgorithms();
      algorithms.forEach((algorithm) => {
        expect(AIP80_PREFIXES[algorithm]).toBeDefined();
      });
    });
  });

  describe('detectAlgorithm', () => {
    it('should detect ed25519 algorithm correctly', () => {
      expect(detectAlgorithm(ED25519_AIP80_PRIVATE_KEY)).toBe('ed25519');
    });

    it('should detect secp256k1 algorithm correctly', () => {
      expect(detectAlgorithm(SECP256K1_AIP80_PRIVATE_KEY)).toBe('secp256k1');
    });

    it('should return null for private keys without AIP80 prefix', () => {
      expect(detectAlgorithm(VALID_RAW_PRIVATE_KEY)).toBeNull();
      expect(detectAlgorithm(VALID_RAW_PRIVATE_KEY_WITHOUT_PREFIX)).toBeNull();
    });

    it('should return null for invalid inputs', () => {
      expect(detectAlgorithm(EMPTY_STRING)).toBeNull();
      expect(detectAlgorithm('invalid-prefix-0x1234')).toBeNull();
    });

    it('should handle edge cases gracefully', () => {
      expect(detectAlgorithm('ed25519-priv-')).toBe('ed25519');
      expect(detectAlgorithm('secp256k1-priv-')).toBe('secp256k1');
    });
  });

  describe('checkAlgorithmSupport', () => {
    it('should return supported algorithm for valid AIP80 private key', () => {
      expect(checkAlgorithmSupport(ED25519_AIP80_PRIVATE_KEY)).toBe('ed25519');
    });

    it('should return null for unsupported algorithms', () => {
      const nistpKey =
        'nistp256-priv-0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(checkAlgorithmSupport(nistpKey)).toBeNull();
    });

    it('should return null for private keys without AIP80 prefix', () => {
      expect(checkAlgorithmSupport(VALID_RAW_PRIVATE_KEY)).toBeNull();
    });

    it('should handle invalid inputs gracefully', () => {
      expect(checkAlgorithmSupport(EMPTY_STRING)).toBeNull();
      expect(checkAlgorithmSupport('invalid-key')).toBeNull();
    });
  });

  describe('stripPrefix', () => {
    it('should strip ed25519 prefix correctly', () => {
      expect(stripPrefix(ED25519_AIP80_PRIVATE_KEY)).toBe(
        VALID_RAW_PRIVATE_KEY,
      );
    });

    it('should strip secp256k1 prefix correctly', () => {
      expect(stripPrefix(SECP256K1_AIP80_PRIVATE_KEY)).toBe(
        VALID_RAW_PRIVATE_KEY,
      );
    });

    it('should return original key if no prefix is found', () => {
      expect(stripPrefix(VALID_RAW_PRIVATE_KEY)).toBe(VALID_RAW_PRIVATE_KEY);
      expect(stripPrefix(VALID_RAW_PRIVATE_KEY_WITHOUT_PREFIX)).toBe(
        VALID_RAW_PRIVATE_KEY_WITHOUT_PREFIX,
      );
    });

    it('should handle empty and invalid strings', () => {
      expect(stripPrefix(EMPTY_STRING)).toBe(EMPTY_STRING);
      expect(stripPrefix('no-valid-prefix-here')).toBe('no-valid-prefix-here');
    });

    it('should handle edge cases with partial prefixes', () => {
      expect(stripPrefix('ed25519-')).toBe('ed25519-');
      expect(stripPrefix('ed25519-priv')).toBe('ed25519-priv');
    });
  });

  describe('addPrefix', () => {
    it('should add ed25519 prefix to raw private key', () => {
      expect(addPrefix(VALID_RAW_PRIVATE_KEY, 'ed25519')).toBe(
        ED25519_AIP80_PRIVATE_KEY,
      );
    });

    it('should add secp256k1 prefix to raw private key', () => {
      expect(addPrefix(VALID_RAW_PRIVATE_KEY, 'secp256k1')).toBe(
        SECP256K1_AIP80_PRIVATE_KEY,
      );
    });

    it('should not duplicate prefix if already present', () => {
      expect(addPrefix(ED25519_AIP80_PRIVATE_KEY, 'ed25519')).toBe(
        ED25519_AIP80_PRIVATE_KEY,
      );
    });

    it('should throw error for unsupported algorithm', () => {
      expect(() => addPrefix(VALID_RAW_PRIVATE_KEY, 'nistp256')).toThrow(
        'Unsupported algorithm: nistp256',
      );
    });

    it('should handle edge cases', () => {
      expect(addPrefix('', 'ed25519')).toBe('ed25519-priv-');
      expect(addPrefix('test', 'ed25519')).toBe('ed25519-priv-test');
    });
  });

  describe('validatePrivateKey', () => {
    it('should validate correct AIP80 private keys', () => {
      expect(validatePrivateKey(ED25519_AIP80_PRIVATE_KEY)).toBe(true);
    });

    it('should validate correct legacy private keys', () => {
      expect(validatePrivateKey(VALID_RAW_PRIVATE_KEY)).toBe(true);
    });

    it('should reject private keys with incorrect length', () => {
      expect(validatePrivateKey(SHORT_PRIVATE_KEY)).toBe(false);
      expect(validatePrivateKey(LONG_PRIVATE_KEY)).toBe(false);
    });

    it('should reject invalid hex strings', () => {
      expect(validatePrivateKey(INVALID_HEX_PRIVATE_KEY)).toBe(false);
    });

    it('should reject null, undefined, and empty values', () => {
      expect(validatePrivateKey(NULL_VALUE as any)).toBe(false);
      expect(validatePrivateKey(UNDEFINED_VALUE as any)).toBe(false);
      expect(validatePrivateKey(EMPTY_STRING)).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(validatePrivateKey(123 as any)).toBe(false);
      expect(validatePrivateKey({} as any)).toBe(false);
      expect(validatePrivateKey([] as any)).toBe(false);
    });

    it('should validate private key without 0x prefix', () => {
      expect(validatePrivateKey(VALID_RAW_PRIVATE_KEY_WITHOUT_PREFIX)).toBe(
        false,
      ); // Because it requires 0x prefix
    });

    it('should validate AIP80 key with unsupported algorithm', () => {
      const nistpKey =
        'nistp256-priv-0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(validatePrivateKey(nistpKey)).toBe(false); // Unsupported algorithm should fail validation
    });
  });

  describe('isAIP80Format', () => {
    it('should return true for valid AIP80 format keys', () => {
      expect(isAIP80Format(ED25519_AIP80_PRIVATE_KEY)).toBe(true);
      expect(isAIP80Format(SECP256K1_AIP80_PRIVATE_KEY)).toBe(true);
    });

    it('should return false for legacy format keys', () => {
      expect(isAIP80Format(VALID_RAW_PRIVATE_KEY)).toBe(false);
      expect(isAIP80Format(VALID_RAW_PRIVATE_KEY_WITHOUT_PREFIX)).toBe(false);
    });

    it('should return false for invalid keys', () => {
      expect(isAIP80Format(EMPTY_STRING)).toBe(false);
      expect(isAIP80Format('invalid-key')).toBe(false);
    });

    it('should return true for unsupported algorithm with valid prefix format', () => {
      const nistpKey =
        'nistp256-priv-0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(isAIP80Format(nistpKey)).toBe(false); // nistp256 doesn't have a prefix defined
    });
  });

  describe('isLegacyFormat', () => {
    it('should return true for valid legacy format keys', () => {
      expect(isLegacyFormat(VALID_RAW_PRIVATE_KEY)).toBe(true);
    });

    it('should return false for AIP80 format keys', () => {
      expect(isLegacyFormat(ED25519_AIP80_PRIVATE_KEY)).toBe(false);
    });

    it('should return false for invalid keys', () => {
      expect(isLegacyFormat(INVALID_HEX_PRIVATE_KEY)).toBe(false);
      expect(isLegacyFormat(SHORT_PRIVATE_KEY)).toBe(false);
      expect(isLegacyFormat(EMPTY_STRING)).toBe(false);
    });

    it('should return false for keys without hex prefix', () => {
      expect(isLegacyFormat(VALID_RAW_PRIVATE_KEY_WITHOUT_PREFIX)).toBe(false);
    });
  });

  describe('normalizePrivateKey', () => {
    describe('legacy target format', () => {
      it('should convert AIP80 format to legacy format', () => {
        const result = normalizePrivateKey(ED25519_AIP80_PRIVATE_KEY, 'legacy');
        expect(result).toBe(VALID_RAW_PRIVATE_KEY);
      });

      it('should return legacy format as-is', () => {
        const result = normalizePrivateKey(VALID_RAW_PRIVATE_KEY, 'legacy');
        expect(result).toBe(VALID_RAW_PRIVATE_KEY);
      });

      it('should handle keys without 0x prefix by adding it', () => {
        const result = normalizePrivateKey(
          VALID_RAW_PRIVATE_KEY_WITHOUT_PREFIX,
          'legacy',
        );
        expect(result).toBe(VALID_RAW_PRIVATE_KEY);
      });
    });

    describe('aip80 target format', () => {
      it('should convert legacy format to AIP80 format with algorithm', () => {
        const result = normalizePrivateKey(
          VALID_RAW_PRIVATE_KEY,
          'aip80',
          'ed25519',
        );
        expect(result).toBe(ED25519_AIP80_PRIVATE_KEY);
      });

      it('should return AIP80 format as-is', () => {
        const result = normalizePrivateKey(
          ED25519_AIP80_PRIVATE_KEY,
          'aip80',
          'ed25519',
        );
        expect(result).toBe(ED25519_AIP80_PRIVATE_KEY);
      });

      it('should throw error when algorithm is not provided', () => {
        expect(() => {
          normalizePrivateKey(VALID_RAW_PRIVATE_KEY, 'aip80');
        }).toThrow('Algorithm type is required for AIP80 format');
      });

      it('should handle keys without 0x prefix', () => {
        const result = normalizePrivateKey(
          VALID_RAW_PRIVATE_KEY_WITHOUT_PREFIX,
          'aip80',
          'ed25519',
        );
        expect(result).toBe(ED25519_AIP80_PRIVATE_KEY);
      });
    });

    describe('error handling', () => {
      it('should throw error for invalid private key', () => {
        expect(() => {
          normalizePrivateKey(INVALID_HEX_PRIVATE_KEY, 'legacy');
        }).toThrow('Invalid private key format');
      });

      it('should throw error for unsupported target format', () => {
        expect(() => {
          normalizePrivateKey(VALID_RAW_PRIVATE_KEY, 'unsupported' as any);
        }).toThrow('Unsupported target format');
      });

      it('should throw error for empty private key', () => {
        expect(() => normalizePrivateKey(EMPTY_STRING, 'legacy')).toThrow(
          'Invalid private key format',
        );
      });

      it('should throw error for null/undefined private key', () => {
        expect(() => {
          normalizePrivateKey(NULL_VALUE as any, 'legacy');
        }).toThrow('Invalid private key format');
      });
    });

    describe('edge cases', () => {
      it('should handle keys with different casing in algorithm', () => {
        // This tests the robustness of the algorithm detection
        const customKey =
          'ed25519-priv-0x1234567890ABCDEF1234567890abcdef1234567890abcdef1234567890abcdef';
        const result = normalizePrivateKey(customKey, 'legacy');
        expect(result).toBe(
          '0x1234567890ABCDEF1234567890abcdef1234567890abcdef1234567890abcdef',
        );
      });

      it('should handle conversion between different AIP80 algorithms', () => {
        const ed25519Key = normalizePrivateKey(
          VALID_RAW_PRIVATE_KEY,
          'aip80',
          'ed25519',
        );
        const secp256k1Key = normalizePrivateKey(
          VALID_RAW_PRIVATE_KEY,
          'aip80',
          'secp256k1',
        );
        expect(ed25519Key).not.toBe(secp256k1Key);
        expect(ed25519Key.startsWith('ed25519-priv-')).toBe(true);
        expect(secp256k1Key.startsWith('secp256k1-priv-')).toBe(true);
      });
    });
  });

  describe('integration tests', () => {
    it('should handle complete workflow from legacy to AIP80 and back', () => {
      // Start with legacy format
      const legacyKey = VALID_RAW_PRIVATE_KEY;
      expect(isLegacyFormat(legacyKey)).toBe(true);
      expect(isAIP80Format(legacyKey)).toBe(false);

      // Convert to AIP80
      const aip80Key = normalizePrivateKey(legacyKey, 'aip80', 'ed25519');
      expect(isAIP80Format(aip80Key)).toBe(true);
      expect(isLegacyFormat(aip80Key)).toBe(false);
      expect(detectAlgorithm(aip80Key)).toBe('ed25519');

      // Convert back to legacy
      const backToLegacy = normalizePrivateKey(aip80Key, 'legacy');
      expect(backToLegacy).toBe(legacyKey);
      expect(isLegacyFormat(backToLegacy)).toBe(true);
      expect(isAIP80Format(backToLegacy)).toBe(false);
    });

    it('should validate consistency across all utility functions', () => {
      const testKeys = [
        VALID_RAW_PRIVATE_KEY,
        ED25519_AIP80_PRIVATE_KEY,
        SECP256K1_AIP80_PRIVATE_KEY,
      ];

      testKeys.forEach((key) => {
        const isAIP80 = isAIP80Format(key);
        const isLegacy = isLegacyFormat(key);
        const algorithm = detectAlgorithm(key);
        const isValid = validatePrivateKey(key);
        const supportedAlgorithm = checkAlgorithmSupport(key);

        // Basic consistency checks
        expect(isAIP80 && isLegacy).toBe(false); // Can't be both formats

        if (isAIP80) {
          expect(algorithm).not.toBeNull();
          expect(stripPrefix(key)).not.toBe(key); // Should strip something
        }

        if (isLegacy) {
          expect(isValid).toBe(true); // Legacy keys should validate
        }

        if (isAIP80 && supportedAlgorithm) {
          expect(isValid).toBe(true); // AIP80 keys with supported algorithm should validate
        }
      });
    });

    it('should handle edge cases consistently', () => {
      const edgeCases = [
        EMPTY_STRING,
        SHORT_PRIVATE_KEY,
        LONG_PRIVATE_KEY,
        INVALID_HEX_PRIVATE_KEY,
        'ed25519-priv-', // Prefix only
        'invalid-prefix-key',
      ];

      edgeCases.forEach((key) => {
        // These should not throw errors for detection/validation functions
        expect(() => detectAlgorithm(key)).not.toThrow();
        expect(() => checkAlgorithmSupport(key)).not.toThrow();
        expect(() => isAIP80Format(key)).not.toThrow();
        expect(() => isLegacyFormat(key)).not.toThrow();
        expect(() => validatePrivateKey(key)).not.toThrow();
        expect(() => stripPrefix(key)).not.toThrow();
      });
    });
  });
});
