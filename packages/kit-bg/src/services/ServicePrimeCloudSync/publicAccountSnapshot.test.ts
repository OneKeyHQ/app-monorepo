import { EDBAccountType } from '../../dbs/local/consts';

import {
  PublicAccountSnapshotUnsupportedError,
  buildPublicAccountSnapshot,
  getPublicAccountSnapshotId,
  normalizePublicAccountSnapshot,
  publicAccountIdentityEqual,
  publicAccountSnapshotToAccount,
} from './publicAccountSnapshot';
import {
  PUBLIC_ACCOUNT_TEST_XFP,
  publicAccountTestSnapshot,
} from './publicAccountSnapshot.test-utils';

import type { IDBWallet } from '../../dbs/local/types';

describe('versioned public account snapshot codec', () => {
  test('projects only public fields and remaps local IDs without creating a wallet', () => {
    const snapshot = publicAccountTestSnapshot();
    const wallet: IDBWallet = {
      id: 'hw-source-device',
      type: 'hw',
      xfp: PUBLIC_ACCOUNT_TEST_XFP,
      associatedDevice: 'private-local-pairing',
      name: 'Wallet',
      backuped: true,
      walletNo: 1,
      nextIds: {},
      accounts: [],
    };
    const source = {
      ...publicAccountSnapshotToAccount(snapshot, wallet.id),
      findAddresses: { '0/100': 'never-upload' },
      customAddresses: { '0/101': 'never-upload' },
      __hwExtraInfo__: undefined,
      session: 'never-upload',
      seed: 'never-upload',
      credential: 'never-upload',
    };
    const exported = buildPublicAccountSnapshot({ wallet, account: source });
    expect(exported).toEqual(normalizePublicAccountSnapshot(snapshot));
    expect(JSON.stringify(exported)).not.toContain('never-upload');
    expect(JSON.stringify(exported)).not.toContain(wallet.id);
    expect(JSON.stringify(exported)).not.toContain(wallet.associatedDevice);
    const copied = publicAccountSnapshotToAccount(
      snapshot,
      'hw-receiver-device',
    );
    expect(copied.id).toBe("hw-receiver-device--m/44'/60'/0'/0/0");
    expect(copied.indexedAccountId).toBe('hw-receiver-device--0');
    expect(copied.type).toBe(EDBAccountType.SIMPLE);
    expect(publicAccountIdentityEqual(source, copied)).toBe(true);
  });

  test('freezes path identity but distinguishes wallet, hidden wallet, and derivation variants', () => {
    const normal = publicAccountTestSnapshot();
    const renamed = {
      ...normal,
      account: { ...normal.account, name: 'Other name' },
    };
    expect(getPublicAccountSnapshotId(renamed)).toBe(
      getPublicAccountSnapshotId(normal),
    );
    expect(
      getPublicAccountSnapshotId({
        ...normal,
        wallet: { ...normal.wallet, hidden: true },
      }),
    ).not.toBe(getPublicAccountSnapshotId(normal));
    const ledger = {
      ...normal,
      account: {
        ...normal.account,
        template: "m/44'/60'/$$INDEX$$'/0/0",
        idSuffix: 'LedgerLive',
      },
    };
    expect(getPublicAccountSnapshotId(ledger)).not.toBe(
      getPublicAccountSnapshotId(normal),
    );
    expect(
      publicAccountSnapshotToAccount(ledger, 'hw-target').id.endsWith(
        '--LedgerLive',
      ),
    ).toBe(true);
    const wrongAddress = publicAccountSnapshotToAccount(
      {
        ...normal,
        account: { ...normal.account, address: `0x${'2'.repeat(40)}` },
      },
      'hw-target',
    );
    expect(
      publicAccountIdentityEqual(
        publicAccountSnapshotToAccount(normal, 'hw-target'),
        wrongAddress,
      ),
    ).toBe(false);
  });

  test.each([
    { version: 2, futureField: 'new format' },
    { capabilities: ['account-copy-v1', 'future-required-capability'] },
    { schema: 'future-account' },
  ])(
    'refuses future required formats %j without guessing a converter',
    (patch) => {
      expect(() =>
        normalizePublicAccountSnapshot({
          ...publicAccountTestSnapshot(),
          ...patch,
        }),
      ).toThrow(PublicAccountSnapshotUnsupportedError);
    },
  );

  test.each([
    { seed: 'never-accepted' },
    { passphrase: 'never-accepted' },
    { path: "m/44'/60'/0'/0/9" },
    { pathIndex: -1 },
    { pathIndex: 0x80_00_00_00 },
    { networkId: 'sol--101' },
    { name: 'a'.repeat(257) },
    { addresses: { '0/0': 'not-simple-data' } },
  ])('rejects malformed or non-public account fields %j', (patch) => {
    const original = publicAccountTestSnapshot();
    expect(() =>
      normalizePublicAccountSnapshot({
        ...original,
        account: { ...original.account, ...patch },
      }),
    ).toThrow();
  });

  test('bounds a wide BTC map before allocating all of its keys', () => {
    const original = publicAccountTestSnapshot();
    const addresses: Record<string, string> = {};
    for (let index = 0; index < 1000; index += 1)
      addresses[`0/${index}`] = 'not-an-address';
    expect(() =>
      normalizePublicAccountSnapshot({
        ...original,
        account: {
          ...original.account,
          impl: 'btc',
          type: 'utxo',
          networkId: 'btc--0',
          coinType: '0',
          path: "m/84'/0'/0'",
          template: "m/84'/0'/$$INDEX$$'/0/0",
          xpub: PUBLIC_ACCOUNT_TEST_XFP.split('--')[1],
          relPath: '0/0',
          addresses,
        },
      }),
    ).toThrow();
  });

  test('copies the existing software Taproot descriptor and rejects private or mismatched descriptor data', () => {
    const original = publicAccountTestSnapshot();
    const xpub = PUBLIC_ACCOUNT_TEST_XFP.split('--')[1];
    const descriptor = `tr([12345678/86'/0'/0']${xpub}/<0;1>/*)`;
    const snapshot = {
      ...original,
      wallet: { ...original.wallet, kind: 'hd' as const },
      account: {
        ...original.account,
        impl: 'btc' as const,
        type: 'utxo' as const,
        networkId: 'btc--0',
        coinType: '0',
        path: "m/86'/0'/0'",
        template: "m/86'/0'/$$INDEX$$'/0/0",
        xpub,
        xpubSegwit: descriptor,
        relPath: '0/0',
        addresses: { '0/0': original.account.address },
      },
    };
    expect(normalizePublicAccountSnapshot(snapshot).account.xpubSegwit).toBe(
      descriptor,
    );
    for (const xpubSegwit of [
      '',
      descriptor.replace('12345678', '87654321'),
      descriptor.replace("/86'/0'/0'", "/86'/0'/1'"),
      descriptor.replace('xpub', 'xprv'),
      'not-public-descriptor-data',
    ])
      expect(() =>
        normalizePublicAccountSnapshot({
          ...snapshot,
          account: { ...snapshot.account, xpubSegwit },
        }),
      ).toThrow();
  });
});
