import fs from 'fs';
import path from 'path';

import { mnemonicToSeedSync } from 'bip39';
import bs58check from 'bs58check';
import * as keys from 'onekey-zcash-keys';

import { deriveZcashAccountSecrets } from './accountSecrets';

// TS-derived account keys fed to the installed keys WASM must reproduce the
// pinned firmware parity UFVKs (app-modules account_keys.rs
// hardware_parity_vectors) and the release address goldens.
const ABANDON_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const HARDWARE_PARITY_UFVKS: [number, string][] = [
  [
    0,
    'uview1s8x5c6zq8pllw2v8ywmcp0fm46d5dk0er8gwwraz2l2s6g0cvq0jlyar820w9z6sh5l285d2ctzcukr2j2fn6cl7nyapa235fxkcmf7xkg4e3pc0phu7e95mukwx3j8t96p7yzuuxhdl9u28letaxay3gyscd9s4tr59dxg4uulsdxjxmy64ls4sy36n8p03j7f0d9w4ycjullvp5lqgslc4agjlgxzk53wnwkcm4andl5xqgs2afa7ewkkfl9fcyw7s5kknzlmn55m6sz93yvqpx78shy0uausk3avw',
  ],
  [
    1,
    'uview1anf6l9jhehdpktvfw4xur3emcrx7yeh6tczezfks6jmgujakhny45uqu6tc0un9ewqlk7uh5eq5fxfacwhgu3pw94yr5khdqdfl660ypxl2xryyqm6hamwwukn5dygk2hkl8lutx3ck5qy9zched9rny0ckz7rezx65um0rj0l0lcxsry8nzjakx9ftz6lecjjnym76pz5eury9yvh7rnk4pn8l76nc092h5l0x38vnxxgkwngdk0lguqjjy3sa2vzr5vay65p04zh0nqev5wvy5ypv7u060usd8yhqs',
  ],
];

const GOLDEN_ACCOUNT_0 = {
  unifiedAddress:
    'u1y2z9wqt9du4stq2keex78l4vvlkfh3c0n7le0pz80lc4ttcuz5h9qyts73awns77lkgw8zy67qwf0s86rauwg6e9wz7te7yf6vxjtk5g',
  transparentAddress: 't1XVXWCvpMgBvUaed4XDqWtgQgJSu1Ghz7F',
};

describe('Zcash account keys: TS derivation vs installed keys WASM', () => {
  const seed = mnemonicToSeedSync(ABANDON_MNEMONIC);

  beforeAll(() => {
    const pkgDir = path.dirname(
      require.resolve('onekey-zcash-keys/package.json'),
    );
    keys.initSync({
      module: fs.readFileSync(path.join(pkgDir, 'onekey_zcash_keys_bg.wasm')),
    });
  });

  afterAll(() => {
    seed.fill(0);
  });

  it.each(HARDWARE_PARITY_UFVKS)(
    'account %i rebuilds the hardware parity UFVK',
    (accountIndex, expectedUfvk) => {
      const secrets = deriveZcashAccountSecrets({ seed, accountIndex });
      try {
        expect(
          keys.ufvkFromAccountKeys(
            'main',
            secrets.orchardSk,
            secrets.accountXpub,
            accountIndex,
          ),
        ).toBe(expectedUfvk);
      } finally {
        secrets.orchardSk.fill(0);
      }
    },
  );

  it('account 0 keeps the release address goldens', () => {
    const secrets = deriveZcashAccountSecrets({ seed, accountIndex: 0 });
    try {
      const ufvk = keys.ufvkFromAccountKeys(
        'main',
        secrets.orchardSk,
        secrets.accountXpub,
        0,
      );
      expect(keys.unifiedAddress('main', ufvk, 'orchard')).toBe(
        GOLDEN_ACCOUNT_0.unifiedAddress,
      );
      expect(keys.transparentAddressFromUfvk('main', ufvk)).toBe(
        GOLDEN_ACCOUNT_0.transparentAddress,
      );
    } finally {
      secrets.orchardSk.fill(0);
    }
  });

  it('the TS account xprv signs a transparent spend of the UFVK address', () => {
    const secrets = deriveZcashAccountSecrets({ seed, accountIndex: 0 });
    try {
      const hash = Buffer.from(
        bs58check.decode(GOLDEN_ACCOUNT_0.transparentAddress),
      )
        .subarray(2)
        .toString('hex');
      const outpoint = { txid: '11'.repeat(32), vout: 0 };
      const request = {
        network: 'main',
        accountIndex: 0,
        targetHeight: 3_500_000,
        expiryHeight: 3_500_020,
        utxos: [
          {
            ...outpoint,
            valueZat: '100000',
            scriptPubKey: `76a914${hash}88ac`,
            isCoinbase: false,
            confirmations: 1,
            derivationPath: "m/44'/133'/0'/0/0",
          },
        ],
        selectedOutpoints: [outpoint],
        recipients: [{ address: GOLDEN_ACCOUNT_0.transparentAddress }],
        sendMax: true,
      };
      const built = JSON.parse(
        keys.transparentTxBuildWithAccountXprv(
          JSON.stringify(request),
          bs58check.encode(Buffer.from(secrets.accountXprvHex, 'hex')),
        ),
      ) as { txid: string; rawTx: string };
      expect(built.txid).toMatch(/^[0-9a-f]{64}$/);
      expect(built.rawTx).toMatch(/^[0-9a-f]+$/);
    } finally {
      secrets.orchardSk.fill(0);
    }
  });

  it('rejects account keys that do not match the requested account', () => {
    const secrets = deriveZcashAccountSecrets({ seed, accountIndex: 1 });
    try {
      expect(() =>
        keys.ufvkFromAccountKeys(
          'main',
          secrets.orchardSk,
          secrets.accountXpub,
          0,
        ),
      ).toThrow();
    } finally {
      secrets.orchardSk.fill(0);
    }
  });
});
