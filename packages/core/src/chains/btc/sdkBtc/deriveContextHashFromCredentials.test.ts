import {
  encryptImportedCredential,
  encryptRevealableSeed,
  mnemonicToRevealableSeed,
} from '../../../secret';

import { deriveContextHashFromBtcCredentials } from './deriveContextHashFromCredentials';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'a-test-password';
// First receive address of BIP-44 Bitcoin account 0 — matches the §4.2
// integration KAT in the babylon-toolkit deriveContextHash spec.
const LEAF_PATH_DEFAULT = "m/44'/0'/0'/0/0";

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
  describe('HD path: output is per-public-key (per connected leaf)', () => {
    it('produces identical output across multiple invocations with the same hd credential and leaf path', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      const args = {
        credentials: { hd },
        password: PASSWORD,
        leafPath: LEAF_PATH_DEFAULT,
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

    // Cross-wallet integration KAT from the babylon-toolkit spec §4.2.
    // Standard "abandon × 11 / about" mnemonic, no passphrase, leaf at
    // m/44'/0'/0'/0/0. Any conforming wallet MUST produce this exact output.
    it('matches the §4.2 cross-wallet KAT for the standard test mnemonic', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      const out = await deriveContextHashFromBtcCredentials({
        credentials: { hd },
        password: PASSWORD,
        leafPath: LEAF_PATH_DEFAULT,
        appName: 'test-app',
        context: 'deadbeef',
      });
      expect(out).toBe(
        '650b3fa2cf958ecd258544af2b812c3e8a3f4f75ea5d030cb4dd175da551e356',
      );
    });

    it('different leaf paths produce different outputs (per-public-key)', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      const args = {
        credentials: { hd },
        password: PASSWORD,
        appName: 'test-app',
        context: 'deadbeef',
      };
      const a = await deriveContextHashFromBtcCredentials({
        ...args,
        leafPath: LEAF_PATH_DEFAULT, // m/44'/0'/0'/0/0
      });
      const b = await deriveContextHashFromBtcCredentials({
        ...args,
        leafPath: "m/44'/0'/0'/0/1", // next receive index
      });
      const c = await deriveContextHashFromBtcCredentials({
        ...args,
        leafPath: "m/86'/0'/0'/0/0", // different address type (Taproot)
      });
      expect(a).not.toBe(b);
      expect(a).not.toBe(c);
      expect(b).not.toBe(c);
    });

    // Regression: fresh-address support hands the keyring a non-0/0 leaf
    // path. The IKM must come from THAT leaf, not silently fall back to 0/0.
    it('non-0/0 receive leaf participates in IKM selection', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      const args = {
        credentials: { hd },
        password: PASSWORD,
        appName: 'test-app',
        context: 'deadbeef',
      };
      const at0 = await deriveContextHashFromBtcCredentials({
        ...args,
        leafPath: "m/44'/0'/0'/0/0",
      });
      const at5 = await deriveContextHashFromBtcCredentials({
        ...args,
        leafPath: "m/44'/0'/0'/0/5",
      });
      expect(at0).not.toBe(at5);
    });

    // Locks the contract that the BIP-39 passphrase IS part of the seed
    // identity. Two HD wallets that share a recovery phrase but differ in
    // BIP-39 passphrase MUST produce different outputs even at the same
    // leaf path.
    it('different BIP-39 passphrases produce different outputs at the same leaf path', async () => {
      const hdNoPass = await makeHdCredential(TEST_MNEMONIC);
      const hdWithPass = await makeHdCredential(TEST_MNEMONIC, 'extra-pass');
      const args = {
        password: PASSWORD,
        leafPath: LEAF_PATH_DEFAULT,
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

    it('rejects when leafPath is missing for an HD credential', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      await expect(
        deriveContextHashFromBtcCredentials({
          credentials: { hd },
          password: PASSWORD,
          appName: 'test-app',
          context: 'deadbeef',
        }),
      ).rejects.toThrow('connected leaf BIP-32 path');
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
    it('HD leaf-derived IKM and a raw-key IKM produce different outputs', async () => {
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
        leafPath: LEAF_PATH_DEFAULT,
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
          leafPath: LEAF_PATH_DEFAULT,
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
