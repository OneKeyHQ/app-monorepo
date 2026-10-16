import { mnemonicToSeedSync } from 'bip39';
import bs58check from 'bs58check';

import { getBitcoinBip32 } from '../btc/sdkBtc';

import {
  deriveZcashAccountSecrets,
  deriveZcashAccountViewingSecrets,
} from './accountSecrets';
import {
  deriveZcashOrchardSpendingKey,
  zcashSeedFingerprintHex,
} from './zip32Orchard';

const ABANDON_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('deriveZcashAccountSecrets', () => {
  const seed = mnemonicToSeedSync(ABANDON_MNEMONIC);
  const seedSnapshot = Buffer.from(seed);

  afterAll(() => {
    seed.fill(0);
    seedSnapshot.fill(0);
  });

  it.each([0, 1, 0x7f_ff_ff_ff])(
    'derives account-scoped keys for account %i without touching the seed',
    (accountIndex) => {
      const secrets = deriveZcashAccountSecrets({ seed, accountIndex });
      try {
        expect(seed.equals(seedSnapshot)).toBe(true);
        expect(secrets.orchardSk).toEqual(
          deriveZcashOrchardSpendingKey({ seed, accountIndex }),
        );
        expect(secrets.seedFingerprintHex).toBe(zcashSeedFingerprintHex(seed));

        const payload = Buffer.from(secrets.accountXprvHex, 'hex');
        expect(payload.length).toBe(78);
        expect(payload.readUInt32BE(0)).toBe(0x04_88_ad_e4);
        expect(payload[4]).toBe(3);
        expect(payload.readUInt32BE(9)).toBe(
          (0x80_00_00_00 + accountIndex) >>> 0,
        );
        expect(payload[45]).toBe(0);

        const expected = getBitcoinBip32()
          .fromSeed(Buffer.from(seed))
          .derivePath(`m/44'/133'/${accountIndex}'`);
        expect(bs58check.encode(payload)).toBe(expected.toBase58());
        expect(secrets.accountXpub).toBe(expected.neutered().toBase58());
      } finally {
        secrets.orchardSk.fill(0);
      }
    },
  );

  it('viewing secrets carry no transparent private key', () => {
    const viewing = deriveZcashAccountViewingSecrets({ seed, accountIndex: 0 });
    const signing = deriveZcashAccountSecrets({ seed, accountIndex: 0 });
    try {
      expect(new Set(Object.keys(viewing))).toEqual(
        new Set(['accountXpub', 'orchardSk', 'seedFingerprintHex']),
      );
      expect(viewing.accountXpub).toBe(signing.accountXpub);
      expect(viewing.orchardSk).toEqual(signing.orchardSk);
    } finally {
      viewing.orchardSk.fill(0);
      signing.orchardSk.fill(0);
    }
  });

  it.each([-1, 0x80_00_00_00, 0.5])('rejects account index %p', (index) => {
    expect(() =>
      deriveZcashAccountSecrets({ seed, accountIndex: index }),
    ).toThrow('invalid account index');
  });
});
