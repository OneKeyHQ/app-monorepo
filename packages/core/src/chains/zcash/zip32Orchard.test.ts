import { mnemonicToSeedSync } from 'bip39';

import {
  deriveZcashOrchardSpendingKey,
  zcashSeedFingerprintHex,
  zip32OrchardDerivePath,
  zip32OrchardHardenedChild,
  zip32OrchardMaster,
} from './zip32Orchard';

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

// orchard-0.15.5/src/test_vectors/zip32.rs (zcash-test-vectors orchard_zip32.py)
const VECTOR_SEED = Uint8Array.from({ length: 32 }, (_, i) => i);
const ORCHARD_VECTORS: { path: number[]; sk: string; c: string }[] = [
  {
    path: [],
    sk: '7eee3c1017870990a3dd6891b82f80be8976c1e7dc20d60817a5e88e8b2cd4b8',
    c: 'ab8b7a00509ef20e469b5292b61d474b7cffcb1657924cda720250ae40526677',
  },
  {
    path: [1],
    sk: '98d703fcb40504c95b3b6ed10ecd50082cff97dfd1dd9aa0913c78f977c962af',
    c: '6a041dfb9cfebee97cb1854fdc481cc04f02c9577aa6f13b2c445b80a9669a22',
  },
  {
    path: [1, 2],
    sk: '99afd8894baad58784d0ec08f5148ee2c2a17b2b294b08ef9e0a0cf14bcc0920',
    c: '6da8b57a36c77ad6412a9dc0115f12aced0ee01c402a0cf0a507cb17fc7bbd1d',
  },
  {
    path: [1, 2, 3],
    sk: '96439ea348a4b2ce4ec7beb4543c70274c8f76495d60c5fa5f018b68f3c32367',
    c: 'b196e9b5809d76577a8944c3f8c8a83f93f0c8f5ace6e7bc9ce4396c034d93fe',
  },
];

const ABANDON_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('ZIP-32 Orchard derivation', () => {
  it.each(ORCHARD_VECTORS)(
    'matches the official vector for path $path',
    ({ path, sk, c }) => {
      const key = zip32OrchardDerivePath(VECTOR_SEED, path);
      expect(hex(key.sk)).toBe(sk);
      expect(hex(key.chainCode)).toBe(c);
    },
  );

  it('derives a child without mutating the caller-owned parent', () => {
    const master = zip32OrchardMaster(VECTOR_SEED);
    const child = zip32OrchardHardenedChild(master, 1);
    expect(hex(child.sk)).toBe(ORCHARD_VECTORS[1].sk);
    expect(hex(master.sk)).toBe(ORCHARD_VECTORS[0].sk);
  });

  it('derives the account key at m/32h/133h/account', () => {
    const viaPath = zip32OrchardDerivePath(VECTOR_SEED, [32, 133, 5]);
    expect(
      hex(
        deriveZcashOrchardSpendingKey({ seed: VECTOR_SEED, accountIndex: 5 }),
      ),
    ).toBe(hex(viaPath.sk));
  });

  it.each([31, 253])('rejects a %i-byte seed', (length) => {
    expect(() => zip32OrchardMaster(new Uint8Array(length))).toThrow('32..252');
  });

  it.each([-1, 0x80_00_00_00, 1.5])('rejects child index %p', (index) => {
    const master = zip32OrchardMaster(VECTOR_SEED);
    expect(() => zip32OrchardHardenedChild(master, index)).toThrow(
      'invalid ZIP-32 child index',
    );
  });
});

describe('ZIP-32 seed fingerprint', () => {
  it('matches the zip32 crate vector', () => {
    expect(zcashSeedFingerprintHex(VECTOR_SEED)).toBe(
      'deff604c246710f7176dead02aa746f2fd8d5389f7072556dcb555fdbe5e3ae3',
    );
  });

  it('matches the hardware parity fingerprint for abandon...about', () => {
    const seed = mnemonicToSeedSync(ABANDON_MNEMONIC);
    try {
      expect(zcashSeedFingerprintHex(seed)).toBe(
        '21ed3d7882c7e37fe012b54a6408048048cb09782d4b2938617da793ccd27815',
      );
    } finally {
      seed.fill(0);
    }
  });
});
