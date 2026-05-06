import {
  encryptImportedCredential,
  encryptRevealableSeed,
  mnemonicToRevealableSeed,
} from '../../../secret';

import { deriveContextHashFromBtcCredentials } from './deriveContextHashFromCredentials';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'a-test-password';

async function makeHdCredential(mnemonic: string, passphrase?: string) {
  const rs = mnemonicToRevealableSeed(mnemonic, passphrase);
  return encryptRevealableSeed({ rs, password: PASSWORD });
}

async function makeImportedCredential(privateKeyHex: string) {
  return encryptImportedCredential({
    credential: { privateKey: privateKeyHex },
    password: PASSWORD,
  });
}

describe('deriveContextHashFromBtcCredentials — contract', () => {
  describe('HD path: output is wallet-level (per-seed, not per-account)', () => {
    it('produces identical output across multiple invocations with the same hd credential', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      const args = {
        credentials: { hd },
        password: PASSWORD,
        appName: 'test-app',
        context: 'deadbeef',
      };
      const out1 = await deriveContextHashFromBtcCredentials(args);
      const out2 = await deriveContextHashFromBtcCredentials(args);
      const out3 = await deriveContextHashFromBtcCredentials(args);
      expect(out1).toBe(out2);
      expect(out2).toBe(out3);
      expect(out1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('matches the cross-wallet KAT vector for the standard test mnemonic (no passphrase)', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      const out = await deriveContextHashFromBtcCredentials({
        credentials: { hd },
        password: PASSWORD,
        appName: 'test-app',
        context: 'deadbeef',
      });
      expect(out).toBe(
        '3b0e2d90a01122eed8a520648073892f6b2d8f4419216023d63cdbd49500fca3',
      );
    });

    // Locks the contract that the BIP-39 passphrase IS part of the seed
    // identity. Two HD wallets that share a recovery phrase but differ in
    // BIP-39 passphrase MUST produce different outputs.
    it('different BIP-39 passphrases produce different outputs', async () => {
      const hdNoPass = await makeHdCredential(TEST_MNEMONIC);
      const hdWithPass = await makeHdCredential(TEST_MNEMONIC, 'extra-pass');
      const args = {
        password: PASSWORD,
        appName: 'test-app',
        context: 'deadbeef',
      };
      const a = await deriveContextHashFromBtcCredentials({
        ...args,
        credentials: { hd: hdNoPass },
      });
      const b = await deriveContextHashFromBtcCredentials({
        ...args,
        credentials: { hd: hdWithPass },
      });
      expect(a).not.toBe(b);
    });
  });

  describe('Imported path: output is per-imported-key', () => {
    it('different imported private keys produce different outputs', async () => {
      const k1 = await makeImportedCredential('11'.repeat(32));
      const k2 = await makeImportedCredential('22'.repeat(32));
      const args = {
        password: PASSWORD,
        appName: 'test-app',
        context: 'deadbeef',
      };
      const a = await deriveContextHashFromBtcCredentials({
        ...args,
        credentials: { imported: k1 },
      });
      const b = await deriveContextHashFromBtcCredentials({
        ...args,
        credentials: { imported: k2 },
      });
      expect(a).not.toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
      expect(b).toMatch(/^[0-9a-f]{64}$/);
    });

    it('same imported key produces identical output across invocations', async () => {
      const imp = await makeImportedCredential('11'.repeat(32));
      const args = {
        credentials: { imported: imp },
        password: PASSWORD,
        appName: 'test-app',
        context: 'deadbeef',
      };
      const a = await deriveContextHashFromBtcCredentials(args);
      const b = await deriveContextHashFromBtcCredentials(args);
      expect(a).toBe(b);
    });
  });

  describe('HD vs Imported produce different outputs (independent IKM)', () => {
    it('HD seed-derived IKM and a raw-key IKM produce different outputs', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      const imp = await makeImportedCredential('11'.repeat(32));
      const args = {
        password: PASSWORD,
        appName: 'test-app',
        context: 'deadbeef',
      };
      const hdOut = await deriveContextHashFromBtcCredentials({
        ...args,
        credentials: { hd },
      });
      const impOut = await deriveContextHashFromBtcCredentials({
        ...args,
        credentials: { imported: imp },
      });
      expect(hdOut).not.toBe(impOut);
    });
  });

  describe('Fail-closed validation', () => {
    it('rejects when both hd and imported credentials are present', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      const imp = await makeImportedCredential('11'.repeat(32));
      await expect(
        deriveContextHashFromBtcCredentials({
          credentials: { hd, imported: imp },
          password: PASSWORD,
          appName: 'test-app',
          context: 'deadbeef',
        }),
      ).rejects.toThrow('ambiguous credentials');
    });

    it('rejects when neither credential type is present', async () => {
      await expect(
        deriveContextHashFromBtcCredentials({
          credentials: {},
          password: PASSWORD,
          appName: 'test-app',
          context: 'deadbeef',
        }),
      ).rejects.toThrow('requires HD or imported credentials');
    });

    it('rejects when imported private key is the wrong length', async () => {
      const imp = await makeImportedCredential('aa'.repeat(16));
      await expect(
        deriveContextHashFromBtcCredentials({
          credentials: { imported: imp },
          password: PASSWORD,
          appName: 'test-app',
          context: 'deadbeef',
        }),
      ).rejects.toThrow('32-byte imported private key');
    });
  });
});
