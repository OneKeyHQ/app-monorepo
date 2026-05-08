import bs58check from 'bs58check';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  encryptImportedCredential,
  encryptRevealableSeed,
  mnemonicToRevealableSeed,
} from '../../../secret';

import { getBitcoinBip32 } from '.';

import { deriveContextHashFromBtcCredentials } from './deriveContextHashFromCredentials';

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const ALT_MNEMONIC =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'a-test-password';
// First receive address of BIP-44 Bitcoin account 0 — matches the §4.2
// integration KAT in the babylon-toolkit deriveContextHash spec.
const LEAF_PATH_DEFAULT = "m/44'/0'/0'/0/0";
// Account-level node for BIP-44 Bitcoin account 0; relative leafPath under
// this xpriv is "0/0", which corresponds to LEAF_PATH_DEFAULT under HD.
const ACCOUNT_PATH_BIP44 = "m/44'/0'/0'";

async function makeHdCredential(mnemonic: string, passphrase?: string) {
  const rs = mnemonicToRevealableSeed(mnemonic, passphrase);
  return encryptRevealableSeed({ rs, password: PASSWORD });
}

// Produces a serialized xpriv hex in the same shape OneKey persists for
// imported BTC accounts (`bs58check.decode(xprvtBase58)` → 78-byte hex),
// rooted at `accountPath` of `mnemonic`.
function makeXprivHex(mnemonic: string, accountPath: string): string {
  const rs = mnemonicToRevealableSeed(mnemonic);
  const seed = Buffer.from(rs.seed, 'hex');
  const accountNode = getBitcoinBip32().fromSeed(seed).derivePath(accountPath);
  const xprivBase58 = accountNode.toBase58();
  return bufferUtils.bytesToHex(Buffer.from(bs58check.decode(xprivBase58)));
}

async function makeImportedXprivCredential(
  mnemonic: string,
  accountPath: string,
) {
  const xprivHex = makeXprivHex(mnemonic, accountPath);
  return encryptImportedCredential({
    credential: { privateKey: xprivHex },
    password: PASSWORD,
  });
}

async function makeImportedRawKeyCredential(privateKeyHex: string) {
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

  describe('Imported xpriv path: per-public-key under imported root', () => {
    // Cross-flow interop: importing the m/44'/0'/0' xpriv of the abandon
    // mnemonic and deriving relative '0/0' from it MUST produce the same
    // output as the HD flow at master-rooted m/44'/0'/0'/0/0. Same leaf
    // privkey → same secret. This is the §4.2 KAT viewed from the imported
    // entry point, and proves cross-wallet portability.
    it("matches the §4.2 KAT when the same leaf is reached via imported xpriv at m/44'/0'/0' + leafPath 0/0", async () => {
      const imp = await makeImportedXprivCredential(
        TEST_MNEMONIC,
        ACCOUNT_PATH_BIP44,
      );
      const out = await deriveContextHashFromBtcCredentials({
        credentials: { imported: imp },
        password: PASSWORD,
        leafPath: '0/0',
        appName: 'test-app',
        context: 'deadbeef',
      });
      expect(out).toBe(
        '650b3fa2cf958ecd258544af2b812c3e8a3f4f75ea5d030cb4dd175da551e356',
      );
    });

    it("HD at m/44'/0'/0'/0/0 and imported-xpriv at m/44'/0'/0' + 0/0 produce identical output (same leaf)", async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      const imp = await makeImportedXprivCredential(
        TEST_MNEMONIC,
        ACCOUNT_PATH_BIP44,
      );
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
        leafPath: '0/0',
      });
      expect(hdOut).toBe(impOut);
    });

    it('different leafPaths under the same imported xpriv produce different outputs', async () => {
      const imp = await makeImportedXprivCredential(
        TEST_MNEMONIC,
        ACCOUNT_PATH_BIP44,
      );
      const args = {
        credentials: { imported: imp },
        password: PASSWORD,
        appName: 'test-app',
        context: 'deadbeef',
      };
      const a = await deriveContextHashFromBtcCredentials({
        ...args,
        leafPath: '0/0',
      });
      const b = await deriveContextHashFromBtcCredentials({
        ...args,
        leafPath: '0/1',
      });
      expect(a).not.toBe(b);
    });

    it('same imported xpriv + same leafPath produces identical output across invocations', async () => {
      const imp = await makeImportedXprivCredential(
        TEST_MNEMONIC,
        ACCOUNT_PATH_BIP44,
      );
      const args = {
        credentials: { imported: imp },
        password: PASSWORD,
        leafPath: '0/0',
        appName: 'test-app',
        context: 'deadbeef',
      };
      const a = await deriveContextHashFromBtcCredentials(args);
      const b = await deriveContextHashFromBtcCredentials(args);
      expect(a).toBe(b);
    });

    it('different imported xprivs (different mnemonics) produce different outputs at same leafPath', async () => {
      const imp1 = await makeImportedXprivCredential(
        TEST_MNEMONIC,
        ACCOUNT_PATH_BIP44,
      );
      const imp2 = await makeImportedXprivCredential(
        ALT_MNEMONIC,
        ACCOUNT_PATH_BIP44,
      );
      const args = {
        password: PASSWORD,
        leafPath: '0/0',
        appName: 'test-app',
        context: 'deadbeef',
      };
      const a = await deriveContextHashFromBtcCredentials({
        ...args,
        credentials: { imported: imp1 },
      });
      const b = await deriveContextHashFromBtcCredentials({
        ...args,
        credentials: { imported: imp2 },
      });
      expect(a).not.toBe(b);
    });

    it('rejects when leafPath is missing for an imported credential', async () => {
      const imp = await makeImportedXprivCredential(
        TEST_MNEMONIC,
        ACCOUNT_PATH_BIP44,
      );
      await expect(
        deriveContextHashFromBtcCredentials({
          credentials: { imported: imp },
          password: PASSWORD,
          appName: 'test-app',
          context: 'deadbeef',
        }),
      ).rejects.toThrow('connected leaf BIP-32 path');
    });
  });

  describe('Fail-closed validation', () => {
    it('rejects when both hd and imported credentials are present', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      const imp = await makeImportedXprivCredential(
        TEST_MNEMONIC,
        ACCOUNT_PATH_BIP44,
      );
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

    it('rejects when imported credential is not a 78-byte serialized xpriv', async () => {
      const imp = await makeImportedRawKeyCredential('aa'.repeat(16));
      await expect(
        deriveContextHashFromBtcCredentials({
          credentials: { imported: imp },
          password: PASSWORD,
          leafPath: '0/0',
          appName: 'test-app',
          context: 'deadbeef',
        }),
      ).rejects.toThrow('78-byte serialized xpriv');
    });

    // Defends against accepting an imported xpub (or any 78-byte blob whose
    // byte 45 isn't the 0x00 private-key prefix per BIP-32).
    it('rejects when imported credential has wrong private-key prefix', async () => {
      const validXprivHex = makeXprivHex(TEST_MNEMONIC, ACCOUNT_PATH_BIP44);
      const corrupted = Buffer.from(validXprivHex, 'hex');
      corrupted[45] = 0x02; // public-key prefix instead of 0x00
      const imp = await makeImportedRawKeyCredential(corrupted.toString('hex'));
      await expect(
        deriveContextHashFromBtcCredentials({
          credentials: { imported: imp },
          password: PASSWORD,
          leafPath: '0/0',
          appName: 'test-app',
          context: 'deadbeef',
        }),
      ).rejects.toThrow('xpriv key prefix invalid');
    });

    // Imported xpriv IS the BIP-32 root, so a master-rooted leafPath
    // (`m/...`) is semantically wrong. bip32's derivePath would silently
    // strip the prefix and produce a secret from the right leaf path
    // bytes but wrong semantic intent — we fail-fast instead so caller
    // bugs surface immediately.
    it('rejects when imported leafPath is master-rooted (m/...) instead of relative', async () => {
      const imp = await makeImportedXprivCredential(
        TEST_MNEMONIC,
        ACCOUNT_PATH_BIP44,
      );
      await expect(
        deriveContextHashFromBtcCredentials({
          credentials: { imported: imp },
          password: PASSWORD,
          leafPath: 'm/0/0',
          appName: 'test-app',
          context: 'deadbeef',
        }),
      ).rejects.toThrow('must be relative');
    });

    // Symmetric guard: HD leafPath must be master-rooted, not relative.
    it('rejects when HD leafPath is relative instead of master-rooted', async () => {
      const hd = await makeHdCredential(TEST_MNEMONIC);
      await expect(
        deriveContextHashFromBtcCredentials({
          credentials: { hd },
          password: PASSWORD,
          leafPath: '0/0',
          appName: 'test-app',
          context: 'deadbeef',
        }),
      ).rejects.toThrow('must be master-rooted');
    });
  });
});
