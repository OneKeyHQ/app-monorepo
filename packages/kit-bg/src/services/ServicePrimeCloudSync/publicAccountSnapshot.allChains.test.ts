import bs58 from 'bs58';

import { pubkeyToAddressDetail } from '@onekeyhq/core/src/chains/cosmos/sdkCosmos/address';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  getRegisteredVaultSettingsImpls,
  getVaultSettings,
} from '../../vaults/settings';

import {
  PublicAccountSnapshotUnsupportedError,
  buildPublicAccountSnapshot,
  getPublicAccountSnapshotId,
  normalizePublicAccountSnapshot,
  publicAccountIdentityEqual,
  publicAccountSnapshotToAccount,
} from './publicAccountSnapshot';
import {
  PUBLIC_ACCOUNT_ALL_CHAIN_IMPLS,
  publicAccountAllChainFixtures,
  publicAccountAllChainWallet,
} from './publicAccountSnapshot.allChains.test-utils';
import { PUBLIC_ACCOUNT_CHAIN_POLICIES } from './publicAccountSnapshotV2';

import type { IPublicAccountAllChainFixture } from './publicAccountSnapshot.allChains.test-utils';

test('Base58 public keys remain case sensitive while legacy hexadecimal keys stay canonical', async () => {
  const fixture = (await publicAccountAllChainFixtures()).find(
    (item) => item.impl === 'sol',
  );
  const item = checkIsDefined(fixture);
  const snapshot = checkIsDefined(
    buildPublicAccountSnapshot({
      wallet: publicAccountAllChainWallet(item.kind),
      account: item.account,
    }),
  );
  const account = publicAccountSnapshotToAccount(snapshot, 'hd-receiver');
  const changed = account.pub?.replace(/[a-zA-Z]/, (character) =>
    character === character.toLowerCase()
      ? character.toUpperCase()
      : character.toLowerCase(),
  );
  expect(changed).not.toBe(account.pub);
  const hexPublicKey = Buffer.from(bs58.decode(account.pub ?? '')).toString(
    'hex',
  );
  expect(
    publicAccountIdentityEqual(account, { ...account, pub: hexPublicKey }),
  ).toBe(true);
  expect(
    publicAccountIdentityEqual(account, { ...account, pub: changed ?? '' }),
  ).toBe(false);
  const hex = 'a1'.repeat(32);
  expect(
    publicAccountIdentityEqual(
      { ...account, pub: hex },
      { ...account, pub: hex.toUpperCase() },
    ),
  ).toBe(true);
});

test('v2 wallet kinds reject coercible arrays and objects before wallet matching', async () => {
  const fixture = checkIsDefined(
    (await publicAccountAllChainFixtures()).find(
      (item) => item.impl === 'tron',
    ),
  );
  const snapshot = checkIsDefined(
    buildPublicAccountSnapshot({
      wallet: publicAccountAllChainWallet(fixture.kind),
      account: fixture.account,
    }),
  );
  for (const kind of [['hd'], ['hardware'], { kind: 'hd' }, null, 0]) {
    expect(() =>
      normalizePublicAccountSnapshot({
        ...snapshot,
        wallet: { ...snapshot.wallet, kind },
      }),
    ).toThrow();
  }
});

describe('public account snapshots for every registered chain', () => {
  let fixtures: IPublicAccountAllChainFixture[];
  beforeAll(async () => {
    fixtures = await publicAccountAllChainFixtures();
  });

  const getFixture = (impl: string) =>
    checkIsDefined(fixtures.find((item) => item.impl === impl));
  const build = (item: IPublicAccountAllChainFixture) =>
    checkIsDefined(
      buildPublicAccountSnapshot({
        wallet: publicAccountAllChainWallet(item.kind),
        account: item.account,
      }),
    );

  test('covers the 32 concrete Vault registrations independently of the codec registry', () => {
    const concrete = getRegisteredVaultSettingsImpls().filter(
      (impl) => impl !== 'onekeyall' && impl !== 'aggregate',
    );
    expect(concrete.toSorted()).toEqual(
      [...PUBLIC_ACCOUNT_ALL_CHAIN_IMPLS].toSorted(),
    );
    expect(fixtures).toHaveLength(32);
    expect(fixtures.map((item) => item.impl).toSorted()).toEqual(
      [...PUBLIC_ACCOUNT_ALL_CHAIN_IMPLS].toSorted(),
    );
    expect(Object.keys(PUBLIC_ACCOUNT_CHAIN_POLICIES).toSorted()).toEqual(
      [...PUBLIC_ACCOUNT_ALL_CHAIN_IMPLS].toSorted(),
    );
    expect(fixtures.every((item) => item.source.length > 10)).toBe(true);
    expect(
      fixtures
        .filter((item) => item.kind === 'hardware')
        .map((item) => item.impl),
    ).toEqual(
      expect.arrayContaining([
        'alph',
        'dynex',
        'neo',
        'scdo',
        'lightning',
        'tlightning',
      ]),
    );
  });

  test.each(PUBLIC_ACCOUNT_ALL_CHAIN_IMPLS)(
    '%s: builds the real local public shape and remaps only local identity',
    (impl) => {
      const item = getFixture(impl);
      const snapshot = build(item);
      expect(snapshot.version).toBe(item.expectedVersion);
      expect(snapshot.account.impl).toBe(impl);
      expect(snapshot.account.networkId).toBe(item.networkId);
      expect(snapshot.wallet.kind).toBe(item.kind);
      expect(normalizePublicAccountSnapshot(snapshot)).toEqual(snapshot);
      expect(getPublicAccountSnapshotId(snapshot)).toBe(
        getPublicAccountSnapshotId(normalizePublicAccountSnapshot(snapshot)),
      );
      expect(
        getPublicAccountSnapshotId({
          ...snapshot,
          account: { ...snapshot.account, name: 'Renamed on another device' },
        }),
      ).toBe(getPublicAccountSnapshotId(snapshot));
      const receiverId =
        item.kind === 'hd' ? 'hd-public-receiver' : 'hw-public-receiver';
      const account = publicAccountSnapshotToAccount(snapshot, receiverId);
      expect(account.id).toBe(
        item.account.id.replace(
          publicAccountAllChainWallet(item.kind).id,
          receiverId,
        ),
      );
      expect(account.indexedAccountId).toBe(`${receiverId}--0`);
      expect(publicAccountIdentityEqual(item.account, account)).toBe(true);
      expect(account.path).toBe(item.account.path);
      expect(account.address).toBe(item.account.address);
      expect(account.pub).toBe(item.account.pub);
      expect(account.template).toBe(item.account.template);
      expect(account.networks).toEqual(item.account.networks);
      expect(account.createAtNetwork).toBe(item.networkId);
      if ('addresses' in item.account)
        expect('addresses' in account ? account.addresses : undefined).toEqual(
          item.account.addresses,
        );
      const serialized = stringUtils.stableStringify(snapshot);
      expect(serialized).not.toContain('public-source');
      expect(serialized).not.toContain('public-receiver');
      expect(serialized).not.toMatch(
        /privateKey|mnemonic|seed|accessToken|session|associatedDevice/,
      );
    },
  );

  test('matches the actual Vault templates, coin types and account types rather than invented chain shapes', async () => {
    for (const item of fixtures) {
      const settings = await getVaultSettings({ networkId: item.networkId });
      expect(settings.impl).toBe(item.impl);
      expect(settings.accountType).toBe(item.account.type);
      const suffix = item.account.id.split('--')[2];
      expect(
        Object.values(settings.accountDeriveInfo).some(
          (derive) =>
            derive?.template === item.account.template &&
            derive.coinType === item.account.coinType &&
            derive.idSuffix === suffix,
        ),
      ).toBe(true);
      const policy = PUBLIC_ACCOUNT_CHAIN_POLICIES[item.impl];
      expect(policy.coinType).toBe(item.account.coinType);
      expect(policy.type).toBe(item.account.type);
      expect(Object.keys(policy.templates)).toContain(item.account.template);
    }
  });

  test('keeps real Solana HD base58 public keys and existing hardware v1 identity', () => {
    const item = getFixture('sol');
    const hd = build(item);
    expect(hd.version).toBe(2);
    expect(hd.account.pub).toBe(hd.account.address);
    const hardware = checkIsDefined(
      buildPublicAccountSnapshot({
        wallet: publicAccountAllChainWallet('hardware'),
        account: {
          ...item.account,
          id: item.account.id.replace('hd-public-source', 'hw-public-source'),
          pub: '',
        },
      }),
    );
    expect(hardware.version).toBe(1);
    expect(getPublicAccountSnapshotId(hd)).toMatch(/^cloud-public-account:v1:/);
    const previousHdShape = normalizePublicAccountSnapshot({
      ...hd,
      version: 1,
      capabilities: ['account-copy-v1'],
      account: {
        ...hd.account,
        pub: Buffer.from(bs58.decode(hd.account.pub)).toString('hex'),
      },
    });
    expect(getPublicAccountSnapshotId(hd)).toBe(
      getPublicAccountSnapshotId(previousHdShape),
    );
    expect(getPublicAccountSnapshotId(hardware)).toMatch(
      /^cloud-public-account:v1:/,
    );
  });

  test('preserves Cardano staking, variant network maps and historical hardware shapes', () => {
    const ada = build(getFixture('ada'));
    expect(ada.account.xpub).toMatch(/^[0-9a-f]{128}$/);
    expect(ada.account.addresses?.['2/0']).toMatch(/^stake1/);
    for (const impl of ['cosmos', 'dot', 'fil', 'cfx']) {
      const snapshot = build(getFixture(impl));
      expect(snapshot.account.type).toBe('variant');
      expect(snapshot.account.address).toBe('');
      expect(
        snapshot.account.addresses?.[snapshot.account.networkId],
      ).toBeTruthy();
    }
    const dynex = build(getFixture('dynex'));
    expect(dynex.account.relPath).toBe('');
    expect(dynex.account.xpub).toBeUndefined();
    expect(dynex.account.addresses).toEqual({});
    expect(dynex.account.pub).toBe('');
    const scdo = build(getFixture('scdo'));
    expect(scdo.account.pub).toBe('');
    expect(scdo.account.addresses).toEqual({ '0/0': scdo.account.address });
  });

  test('copies Lightning public xpub metadata without token registration or hardware interaction', () => {
    for (const impl of ['lightning', 'tlightning']) {
      const item = getFixture(impl);
      const snapshot = build(item);
      expect(snapshot.account.path).toMatch(/\/0'$/);
      expect(snapshot.account.pub).toMatch(/^[xt]pub/);
      expect(snapshot.account.relPath).toBe('0/0');
      expect(snapshot.account.addresses).toEqual({
        '0/0': snapshot.account.address,
      });
      expect(snapshot.account.xpub).toBeUndefined();
      expect(snapshot.account.coinType).toBe(
        impl === 'lightning' ? '81297820149147' : '81297820149140',
      );
    }
  });

  test('keeps EVM derivation suffixes and TON contract suffix in mapped local IDs', () => {
    const evm = getFixture('evm');
    const normal = build(evm);
    for (const [template, suffix, path] of [
      ["m/44'/60'/$$INDEX$$'/0/0", 'LedgerLive', "m/44'/60'/0'/0/0"],
      ["m/44'/60'/0'/$$INDEX$$", 'LedgerLegacy', "m/44'/60'/0'/0"],
    ]) {
      const variant = build({
        ...evm,
        account: {
          ...evm.account,
          id: `hd-public-source--${path}--${suffix}`,
          path,
          template,
        },
      });
      expect(variant.version).toBe(1);
      expect(variant.account.idSuffix).toBe(suffix);
      expect(getPublicAccountSnapshotId(variant)).not.toBe(
        getPublicAccountSnapshotId(normal),
      );
      expect(publicAccountSnapshotToAccount(variant, 'hd-target').id).toBe(
        `hd-target--${path}--${suffix}`,
      );
    }
    const ton = build(getFixture('ton'));
    expect(ton.account.idSuffix).toBe(EAddressEncodings.TON_V4R2);
    expect(publicAccountSnapshotToAccount(ton, 'hd-target').id).toBe(
      "hd-target--m/44'/607'/0'--v4R2",
    );
  });

  test('preserves Kaspa official address derivation as a distinct public identity', async () => {
    const item = getFixture('kaspa');
    const original = build(item);
    const derived = await coreChainApi.kaspa.hd.getAddressFromPublic({
      networkInfo: {
        networkId: item.networkId,
        networkImpl: 'kaspa',
        networkChainCode: 'kaspa',
        chainId: 'kaspa',
      },
      publicKey: checkIsDefined(item.account.pub),
      addressEncoding: EAddressEncodings.KASPA_ORG,
    });
    const official = build({
      ...item,
      account: {
        ...item.account,
        id: `${item.account.id}--${EAddressEncodings.KASPA_ORG}`,
        address: derived.address,
      },
    });
    expect(official.account.address).toMatch(/^kaspa:/);
    expect(official.account.address).not.toBe(original.account.address);
    expect(official.account.idSuffix).toBe(EAddressEncodings.KASPA_ORG);
    expect(getPublicAccountSnapshotId(official)).not.toBe(
      getPublicAccountSnapshotId(original),
    );
    const mapped = publicAccountSnapshotToAccount(official, 'hd-target');
    expect(mapped.id).toBe("hd-target--m/44'/111111'/0'/0/0--KaspaOrg");
    expect(mapped.address).toBe(derived.address);
  });

  test('preserves separate Cosmos network addresses and a stable explicitly sorted network scope', () => {
    const item = getFixture('cosmos');
    const original = build(item);
    const networkId = 'cosmos--osmosis-1';
    const osmosis = pubkeyToAddressDetail({
      publicKey: checkIsDefined(item.account.pub),
      curve: 'secp256k1',
      addressPrefix: 'osmo',
    }).address;
    const multiple = build({
      ...item,
      account: {
        ...item.account,
        addresses: {
          ...original.account.addresses,
          [networkId]: osmosis,
        },
        networks: [networkId, item.networkId],
      },
    });
    expect(multiple.account.addresses?.[networkId]).toMatch(/^osmo1/);
    expect(multiple.account.addresses?.[item.networkId]).toMatch(/^cosmos1/);
    const reversed = normalizePublicAccountSnapshot({
      ...multiple,
      account: {
        ...multiple.account,
        networks: (multiple.account.networks ?? []).toReversed(),
      },
    });
    expect(getPublicAccountSnapshotId(reversed)).toBe(
      getPublicAccountSnapshotId(multiple),
    );
    expect(getPublicAccountSnapshotId(multiple)).not.toBe(
      getPublicAccountSnapshotId(original),
    );
    expect(publicAccountSnapshotToAccount(multiple, 'hd-target')).toMatchObject(
      {
        address: '',
        addresses: multiple.account.addresses,
        networks: [item.networkId, networkId].toSorted(),
      },
    );
  });

  test('rejects foreign network maps, missing variant public addresses and unknown formats', () => {
    const snapshot = build(getFixture('cosmos'));
    expect(() =>
      normalizePublicAccountSnapshot({
        ...snapshot,
        account: { ...snapshot.account, addresses: { 'evm--1': 'unrelated' } },
      }),
    ).toThrow();
    expect(() =>
      normalizePublicAccountSnapshot({
        ...snapshot,
        account: { ...snapshot.account, addresses: {} },
      }),
    ).toThrow();
    expect(() =>
      normalizePublicAccountSnapshot({ ...snapshot, version: 99 }),
    ).toThrow(PublicAccountSnapshotUnsupportedError);
    expect(() =>
      normalizePublicAccountSnapshot({
        ...snapshot,
        account: { ...snapshot.account, privateKey: 'forbidden' },
      }),
    ).toThrow();
    expect(() =>
      normalizePublicAccountSnapshot({
        ...snapshot,
        wallet: { ...snapshot.wallet, seed: 'forbidden' },
      }),
    ).toThrow();
    const ada = build(getFixture('ada'));
    expect(() =>
      normalizePublicAccountSnapshot({
        ...ada,
        account: {
          ...ada.account,
          addresses: { ...ada.account.addresses, '3/0': ada.account.address },
        },
      }),
    ).toThrow();
  });

  test.each(['alph', 'dynex', 'neo', 'scdo'])(
    '%s remains hardware-only',
    (impl) => {
      const snapshot = build(getFixture(impl));
      expect(() =>
        normalizePublicAccountSnapshot({
          ...snapshot,
          wallet: { ...snapshot.wallet, kind: 'hd' },
        }),
      ).toThrow();
    },
  );
});
