/* eslint-disable onekey/no-raw-error -- standalone node script helper */
// Plain-JS mirror of core/src/chains/zcash/accountSecrets.ts for the
// standalone verify-*.js scripts, which cannot load TypeScript. The TS
// implementation itself is checked against the WASM in
// accountSecrets.wasmParity.test.ts. Synthetic/public test seeds only.
const { blake2b } = require('@noble/hashes/blake2b');
const { BIP32Factory } = require('bip32');
const bs58check = require('bs58check');
const ecc = require('tiny-secp256k1');

const HARDENED = 0x80_00_00_00;

function orchardSpendingKey(seed, accountIndex) {
  const master = blake2b(seed, {
    dkLen: 64,
    personalization: Buffer.from('ZcashIP32Orchard'),
  });
  let sk = master.slice(0, 32);
  let c = master.slice(32);
  master.fill(0);
  for (const index of [32, 133, accountIndex]) {
    const i = Buffer.alloc(4);
    i.writeUInt32LE((index | HARDENED) >>> 0);
    const h = blake2b.create({
      dkLen: 64,
      personalization: Buffer.from('Zcash_ExpandSeed'),
    });
    h.update(c).update(Uint8Array.of(0x81)).update(sk).update(i);
    const out = h.digest();
    sk.fill(0);
    c.fill(0);
    sk = out.slice(0, 32);
    c = out.slice(32);
    out.fill(0);
  }
  c.fill(0);
  return sk;
}

function seedFingerprintHex(seed) {
  const h = blake2b.create({
    dkLen: 32,
    personalization: Buffer.from('Zcash_HD_Seed_FP'),
  });
  h.update(Uint8Array.of(seed.length)).update(seed);
  return Buffer.from(h.digest()).toString('hex');
}

function deriveAccountKeys(seed, accountIndex) {
  const node = BIP32Factory(ecc)
    .fromSeed(Buffer.from(seed))
    .derivePath(`m/44'/133'/${accountIndex}'`);
  return {
    orchardSk: orchardSpendingKey(seed, accountIndex),
    accountXpub: node.neutered().toBase58(),
    accountXprv: node.toBase58(),
    // Raw private key bytes inside the xprv payload, for memory scans.
    accountPrivateKey: Buffer.from(bs58check.decode(node.toBase58())).subarray(
      46,
    ),
    seedFingerprintHex: seedFingerprintHex(seed),
  };
}

module.exports = { deriveAccountKeys };
