import { Buffer } from 'buffer';

import {
  decryptRevealableSeed,
  encryptRevealableSeed,
  mnemonicFromEntropyAsync,
  mnemonicToRevealableSeed,
  revealEntropyToMnemonic,
  revealableSeedFromMnemonic,
  validateMnemonic,
} from '..';

import type { IBip39RevealableSeed } from '../bip39';

/*
yarn jest packages/core/src/secret/__tests__/bip39-edge-cases.test.ts
*/

describe('BIP39 Edge Cases', () => {
  const TEST_PASSWORD = 'testPassword123';

  describe('revealEntropyToMnemonic', () => {
    it('should reject invalid language code (not 1)', () => {
      // langCode=2, entropyLength=16, followed by 16 bytes entropy + padding
      const buf = Buffer.alloc(34, 0);
      buf[0] = 2; // invalid langCode
      buf[1] = 16;
      expect(() => revealEntropyToMnemonic(buf)).toThrow('invalid entropy');
    });

    it('should reject langCode=0', () => {
      const buf = Buffer.alloc(34, 0);
      buf[0] = 0;
      buf[1] = 16;
      expect(() => revealEntropyToMnemonic(buf)).toThrow('invalid entropy');
    });

    it('should reject invalid entropy length (not 16/20/24/28/32)', () => {
      const buf = Buffer.alloc(34, 0);
      buf[0] = 1;
      buf[1] = 15; // invalid length
      expect(() => revealEntropyToMnemonic(buf)).toThrow('invalid entropy');
    });

    it('should reject entropy length of 0', () => {
      const buf = Buffer.alloc(34, 0);
      buf[0] = 1;
      buf[1] = 0;
      expect(() => revealEntropyToMnemonic(buf)).toThrow('invalid entropy');
    });

    it('should handle all valid entropy lengths (12/15/18/21/24 words)', () => {
      // 16 bytes -> 12 words
      // 20 bytes -> 15 words
      // 24 bytes -> 18 words
      // 28 bytes -> 21 words
      // 32 bytes -> 24 words
      const entropyLengths = [16, 20, 24, 28, 32];
      const expectedWordCounts = [12, 15, 18, 21, 24];

      for (let i = 0; i < entropyLengths.length; i += 1) {
        const entropyLen = entropyLengths[i];
        const buf = Buffer.alloc(2 + 32, 0xab); // fill with non-zero for valid entropy
        buf[0] = 1;
        buf[1] = entropyLen;

        const mnemonic = revealEntropyToMnemonic(buf);
        const words = mnemonic.split(' ');
        expect(words.length).toBe(expectedWordCounts[i]);
      }
    });

    it('should accept hex string input', () => {
      const buf = Buffer.alloc(34, 0);
      buf[0] = 1;
      buf[1] = 16;
      // Fill entropy with zeros (produces "abandon" repeated mnemonic)
      const hex = buf.toString('hex');
      const mnemonic = revealEntropyToMnemonic(hex);
      expect(mnemonic.split(' ').length).toBe(12);
    });

    it('should only use entropyLength bytes, ignoring padding', () => {
      // Create two buffers with same entropy but different padding
      const buf1 = Buffer.alloc(34, 0);
      buf1[0] = 1;
      buf1[1] = 16;
      buf1.fill(0xaa, 2, 18); // entropy
      buf1.fill(0x11, 18, 34); // padding 1

      const buf2 = Buffer.alloc(34, 0);
      buf2[0] = 1;
      buf2[1] = 16;
      buf2.fill(0xaa, 2, 18); // same entropy
      buf2.fill(0xff, 18, 34); // different padding

      expect(revealEntropyToMnemonic(buf1)).toBe(revealEntropyToMnemonic(buf2));
    });
  });

  describe('mnemonicToRevealableSeed', () => {
    it('should throw on invalid mnemonic', () => {
      expect(() =>
        mnemonicToRevealableSeed('invalid mnemonic words here'),
      ).toThrow();
    });

    it('should throw on empty string', () => {
      expect(() => mnemonicToRevealableSeed('')).toThrow();
    });

    it('should produce different seeds with different passphrases', () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const rs1 = mnemonicToRevealableSeed(mnemonic);
      const rs2 = mnemonicToRevealableSeed(mnemonic, 'mypassphrase');
      expect(rs1.seed).not.toBe(rs2.seed);
      // But entropy should be the same (same mnemonic)
      // Extract actual entropy portion
      const entropy1 = Buffer.from(rs1.entropyWithLangPrefixed, 'hex');
      const entropy2 = Buffer.from(rs2.entropyWithLangPrefixed, 'hex');
      expect(entropy1[1]).toBe(entropy2[1]); // same length
      const len = entropy1[1];
      expect(entropy1.subarray(2, 2 + len)).toEqual(
        entropy2.subarray(2, 2 + len),
      );
    });

    it('should round-trip: mnemonic -> seed -> entropy -> mnemonic', () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const rs = mnemonicToRevealableSeed(mnemonic);
      const recovered = revealEntropyToMnemonic(rs.entropyWithLangPrefixed);
      expect(recovered).toBe(mnemonic);
    });

    it('should produce valid entropy format (langCode=1)', () => {
      const mnemonic = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
      const rs = mnemonicToRevealableSeed(mnemonic);
      const entropyBuf = Buffer.from(rs.entropyWithLangPrefixed, 'hex');
      expect(entropyBuf[0]).toBe(1); // langCode
      expect([16, 20, 24, 28, 32]).toContain(entropyBuf[1]); // valid length
    });
  });

  describe('validateMnemonic', () => {
    it('should accept valid 12-word mnemonic', () => {
      expect(
        validateMnemonic(
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        ),
      ).toBe(true);
    });

    it('should accept valid 24-word mnemonic', () => {
      expect(
        validateMnemonic(
          'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote',
        ),
      ).toBe(true);
    });

    it('should reject mnemonic with wrong checksum', () => {
      expect(
        validateMnemonic(
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
        ),
      ).toBe(false);
    });

    it('should reject mnemonic with non-BIP39 words', () => {
      expect(
        validateMnemonic(
          'notaword abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        ),
      ).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateMnemonic('')).toBe(false);
    });
  });

  describe('encryptRevealableSeed / decryptRevealableSeed roundtrip', () => {
    it('should encrypt and decrypt seed correctly', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const rs = mnemonicToRevealableSeed(mnemonic);
      const encrypted = await encryptRevealableSeed({
        rs,
        password: TEST_PASSWORD,
      });
      const decrypted = await decryptRevealableSeed({
        rs: encrypted,
        password: TEST_PASSWORD,
      });

      expect(decrypted.seed).toBe(rs.seed);
      // Entropy portion should match
      const origBuf = Buffer.from(rs.entropyWithLangPrefixed, 'hex');
      const decBuf = Buffer.from(decrypted.entropyWithLangPrefixed, 'hex');
      expect(origBuf[0]).toBe(decBuf[0]);
      expect(origBuf[1]).toBe(decBuf[1]);
      const len = origBuf[1];
      expect(origBuf.subarray(2, 2 + len)).toEqual(decBuf.subarray(2, 2 + len));
    });

    it('should fail decryption with wrong password', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const rs = mnemonicToRevealableSeed(mnemonic);
      const encrypted = await encryptRevealableSeed({
        rs,
        password: TEST_PASSWORD,
      });
      await expect(
        decryptRevealableSeed({ rs: encrypted, password: 'wrongpassword' }),
      ).rejects.toThrow();
    });

    it('should reject invalid seed object', async () => {
      await expect(
        encryptRevealableSeed({
          rs: {} as IBip39RevealableSeed,
          password: TEST_PASSWORD,
        }),
      ).rejects.toThrow('Invalid seed object');
    });

    it('should reject null seed', async () => {
      await expect(
        encryptRevealableSeed({
          rs: null as unknown as IBip39RevealableSeed,
          password: TEST_PASSWORD,
        }),
      ).rejects.toThrow();
    });
  });

  describe('revealableSeedFromMnemonic / mnemonicFromEntropyAsync roundtrip', () => {
    it('should recover mnemonic from encrypted credential', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const encrypted = await revealableSeedFromMnemonic(
        mnemonic,
        TEST_PASSWORD,
      );
      const recovered = await mnemonicFromEntropyAsync({
        hdCredential: encrypted,
        password: TEST_PASSWORD,
      });
      expect(recovered).toBe(mnemonic);
    });

    it('should recover 24-word mnemonic', async () => {
      const mnemonic =
        'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote';
      const encrypted = await revealableSeedFromMnemonic(
        mnemonic,
        TEST_PASSWORD,
      );
      const recovered = await mnemonicFromEntropyAsync({
        hdCredential: encrypted,
        password: TEST_PASSWORD,
      });
      expect(recovered).toBe(mnemonic);
    });

    it('should handle passphrase in seed generation', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const encrypted = await revealableSeedFromMnemonic(
        mnemonic,
        TEST_PASSWORD,
        'mypassphrase',
      );
      // Mnemonic should still be recoverable (passphrase only affects seed, not entropy)
      const recovered = await mnemonicFromEntropyAsync({
        hdCredential: encrypted,
        password: TEST_PASSWORD,
      });
      expect(recovered).toBe(mnemonic);
    });
  });

  describe('Entropy length boundary cases', () => {
    it('should handle minimum entropy (16 bytes / 128 bits)', () => {
      const buf = Buffer.alloc(34, 0);
      buf[0] = 1;
      buf[1] = 16;
      const mnemonic = revealEntropyToMnemonic(buf);
      expect(mnemonic.split(' ').length).toBe(12);
    });

    it('should handle maximum entropy (32 bytes / 256 bits)', () => {
      const buf = Buffer.alloc(34, 0);
      buf[0] = 1;
      buf[1] = 32;
      const mnemonic = revealEntropyToMnemonic(buf);
      expect(mnemonic.split(' ').length).toBe(24);
    });

    it('should reject entropy less than 16 bytes', () => {
      const buf = Buffer.alloc(34, 0);
      buf[0] = 1;
      buf[1] = 12;
      expect(() => revealEntropyToMnemonic(buf)).toThrow('invalid entropy');
    });

    it('should reject entropy more than 32 bytes', () => {
      const buf = Buffer.alloc(34, 0);
      buf[0] = 1;
      buf[1] = 36;
      expect(() => revealEntropyToMnemonic(buf)).toThrow('invalid entropy');
    });

    it('should reject odd entropy lengths', () => {
      const buf = Buffer.alloc(34, 0);
      buf[0] = 1;
      buf[1] = 17;
      expect(() => revealEntropyToMnemonic(buf)).toThrow('invalid entropy');
    });
  });

  describe('Language code boundary cases', () => {
    it('should reject large langCode', () => {
      const buf = Buffer.alloc(34, 0);
      buf[0] = 255;
      buf[1] = 16;
      expect(() => revealEntropyToMnemonic(buf)).toThrow();
    });
  });

  describe('Mnemonic boundary cases', () => {
    it('should reject wrong word count (11 words)', () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(() => mnemonicToRevealableSeed(mnemonic)).toThrow();
    });

    it('should reject word not in wordlist', () => {
      const mnemonic =
        'notaword abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(() => mnemonicToRevealableSeed(mnemonic)).toThrow();
    });

    it('should reject mnemonic with wrong checksum (abandon*11 + ability)', () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon ability';
      expect(() => mnemonicToRevealableSeed(mnemonic)).toThrow();
    });
  });

  describe('Password boundary cases', () => {
    it('should handle empty password', () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const rs1 = mnemonicToRevealableSeed(mnemonic, '');
      const rs2 = mnemonicToRevealableSeed(mnemonic);
      expect(rs1.seed).toBe(rs2.seed);
    });

    it('should handle long password (1000 chars)', () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const longPassword = 'a'.repeat(1000);
      expect(() =>
        mnemonicToRevealableSeed(mnemonic, longPassword),
      ).not.toThrow();
    });

    it('should handle password with special characters', () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      expect(() =>
        mnemonicToRevealableSeed(mnemonic, specialPassword),
      ).not.toThrow();
    });

    it('should handle password with unicode', () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      expect(() =>
        mnemonicToRevealableSeed(mnemonic, '你好世界'),
      ).not.toThrow();
    });

    it('should produce different seeds for different passwords', () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const passwords = ['', 'a', 'A', 'password', 'Password'];
      const seeds = passwords.map(
        (pwd) => mnemonicToRevealableSeed(mnemonic, pwd).seed,
      );
      expect(new Set(seeds).size).toBe(passwords.length);
    });
  });

  describe('Encryption boundary cases', () => {
    it('should reject empty password encryption', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const rs = mnemonicToRevealableSeed(mnemonic);
      await expect(
        encryptRevealableSeed({ rs, password: '' }),
      ).rejects.toThrow();
    });

    it('should handle long password encryption (1000 chars)', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const rs = mnemonicToRevealableSeed(mnemonic);
      const longPassword = 'a'.repeat(1000);
      const encrypted = await encryptRevealableSeed({
        rs,
        password: longPassword,
      });
      const decrypted = await decryptRevealableSeed({
        rs: encrypted,
        password: longPassword,
      });
      expect(decrypted.seed).toBe(rs.seed);
    });

    it('should reject decryption with similar password', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const rs = mnemonicToRevealableSeed(mnemonic);
      const encrypted = await encryptRevealableSeed({
        rs,
        password: 'password',
      });
      await expect(
        decryptRevealableSeed({ rs: encrypted, password: 'Password' }),
      ).rejects.toThrow();
    });

    it('should reject decryption with one-char-different password', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const rs = mnemonicToRevealableSeed(mnemonic);
      const encrypted = await encryptRevealableSeed({
        rs,
        password: 'password',
      });
      await expect(
        decryptRevealableSeed({ rs: encrypted, password: 'passwor' }),
      ).rejects.toThrow();
    });

    it('should handle concurrent encryption/decryption', async () => {
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const rs = mnemonicToRevealableSeed(mnemonic);

      const operations = Array.from({ length: 10 }, async () => {
        const encrypted = await encryptRevealableSeed({
          rs,
          password: 'test',
        });
        return decryptRevealableSeed({ rs: encrypted, password: 'test' });
      });

      const results = await Promise.all(operations);
      results.forEach((result) => {
        expect(result.seed).toBe(rs.seed);
      });
    });
  });

  describe('Error message validation', () => {
    it('should provide clear error for invalid mnemonic', () => {
      try {
        mnemonicToRevealableSeed('invalid mnemonic words here');
      } catch (error: any) {
        expect(error.message).toMatch(/invalid|checksum|wordlist/i);
      }
    });
  });
});
