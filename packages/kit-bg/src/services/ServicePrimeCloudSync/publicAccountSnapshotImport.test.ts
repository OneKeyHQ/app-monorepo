import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { runInNewContext } from 'vm';

import coreTestsFixtures from '@onekeyhq/core/@tests/fixtures/coreTestsFixtures';
import CoreChainHd from '@onekeyhq/core/src/chains/btc/CoreChainHd';
import {
  convertBtcForkXpub,
  getBip32FromBase58,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { ICloudPublicAccountSnapshot } from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { EDBAccountType } from '../../dbs/local/consts';
import { vaultFactory } from '../../vaults/factory';

import {
  buildPublicAccountSnapshot,
  getPublicAccountSnapshotId,
  normalizePublicAccountSnapshot,
  publicAccountIdentityEqual,
  publicAccountSnapshotToAccount,
} from './publicAccountSnapshot';
import { importPublicAccountSnapshots } from './publicAccountSnapshotImport';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { LocalDbBase } from '../../dbs/local/LocalDbBase';
import type {
  IDBAccount,
  IDBCredentialBase,
  IDBWallet,
} from '../../dbs/local/types';
import type { VaultBase } from '../../vaults/base/VaultBase';

jest.mock('../../vaults/factory', () => ({
  vaultFactory: { getWalletOnlyVault: jest.fn() },
}));
jest.mock('@onekeyhq/core/src/instance/coreChainApi', () => ({
  __esModule: true,
  default: {
    btc: { hd: { getAddressFromXpub: jest.fn() } },
    evm: { hd: { getAddressFromPublic: jest.fn() } },
    sol: { hd: { getAddressFromPublic: jest.fn() } },
  },
}));

// Public BIP32 vector (seed bytes 00..0f), never used by production code.
const XPUB =
  'xpub6C1HVMz946r433QEjZGpYYWYcspxXXBPys5PBGkmQboRXE6RLfFiStEkKbWKCZaPgDrzZh9nUEunxuiuy6MNdw23du2Ek7GoKYMJVH8eK5E';
const XFP = `12345678--${XPUB}`;
const EVM_TEMPLATE = "m/44'/60'/0'/0/$$INDEX$$";

function snapshot(
  index = 0,
  kind: 'hardware' | 'hd' = 'hardware',
): ICloudPublicAccountSnapshot {
  return {
    schema: 'onekey-public-account',
    version: 1,
    capabilities: ['account-copy-v1'],
    wallet: { kind, xfp: XFP, hidden: false },
    account: {
      impl: 'evm',
      type: 'simple',
      networkId: 'evm--1',
      coinType: '60',
      path: `m/44'/60'/0'/0/${index}`,
      pathIndex: index,
      template: EVM_TEMPLATE,
      name: `Cloud account ${index}`,
      address: '0x1111111111111111111111111111111111111111',
      pub: '',
    },
  };
}

function wallet(kind: 'hardware' | 'hd' = 'hardware'): IDBWallet {
  return {
    id: kind === 'hardware' ? 'hw-local-device' : 'hd-local',
    type: kind === 'hardware' ? 'hw' : 'hd',
    name: 'Local wallet',
    xfp: XFP,
    accounts: [],
    nextIds: {},
    walletNo: 1,
    backuped: true,
    associatedDevice: kind === 'hardware' ? 'local-device' : undefined,
  };
}

function harness(wallets = [wallet()]) {
  const stored = new Map<string, IDBAccount>();
  const getAllWallets = jest.fn(async () => ({ wallets }));
  const getCredentialSafe = jest.fn(
    async (id: string): Promise<IDBCredentialBase | undefined> => ({
      id,
      credential: 'encrypted-local-test-credential',
    }),
  );
  const getDeviceSafe = jest.fn(async () => ({
    vendor: EHardwareVendor.onekey,
  }));
  const write = jest.fn(
    async ({
      accounts,
      isCurrent,
    }: Parameters<LocalDbBase['importPublicCloudAccounts']>[0]) => {
      if (!isCurrent())
        return {
          added: 0,
          unchanged: 0,
          pending: accounts.length,
          conflicts: 0,
          cancelled: true,
          appliedAccountIds: [],
        };
      let added = 0;
      let unchanged = 0;
      let conflicts = 0;
      const appliedAccountIds: string[] = [];
      for (const account of accounts) {
        const existing = stored.get(account.id);
        if (!existing) {
          stored.set(account.id, account);
          added += 1;
          appliedAccountIds.push(account.id);
        } else if (publicAccountIdentityEqual(existing, account)) {
          unchanged += 1;
          appliedAccountIds.push(account.id);
        } else conflicts += 1;
      }
      return {
        added,
        unchanged,
        conflicts,
        pending: 0,
        cancelled: false,
        appliedAccountIds,
      };
    },
  );
  const prepareAccounts = jest.fn();
  const remove = jest.fn(
    async ({
      accounts,
    }: Parameters<LocalDbBase['deletePublicCloudAccounts']>[0]) => {
      let deleted = 0;
      let unchanged = 0;
      let conflicts = 0;
      const appliedAccountIds: string[] = [];
      const issueByAccountId: Record<string, 'conflicts'> = {};
      for (const account of accounts) {
        const existing = stored.get(account.id);
        if (!existing) {
          unchanged += 1;
          appliedAccountIds.push(account.id);
        } else if (publicAccountIdentityEqual(existing, account)) {
          stored.delete(account.id);
          deleted += 1;
          appliedAccountIds.push(account.id);
        } else {
          conflicts += 1;
          issueByAccountId[account.id] = 'conflicts';
        }
      }
      return {
        deleted,
        added: 0,
        unchanged,
        pending: 0,
        conflicts,
        cancelled: false,
        appliedAccountIds,
        issueByAccountId,
      };
    },
  );
  const getAddressesFromHd = jest.fn();
  const getHardwareSDK = jest.fn();
  const getCachedPassword = jest.fn();
  const validateAddress = jest.fn(async (address: string) => ({
    isValid: true,
    normalizedAddress: address.toLowerCase(),
  }));
  const settings = {
    impl: 'evm',
    accountType: EDBAccountType.SIMPLE,
    accountDeriveInfo: {
      default: {
        template: EVM_TEMPLATE,
        coinType: '60',
        namePrefix: 'EVM',
        addressEncoding: undefined as EAddressEncodings | undefined,
      },
    },
  };
  const getVaultSettings = jest.fn(async () => settings);
  const getVault = jest.fn(
    async () =>
      ({
        keyring: { prepareAccounts },
        coreApi: { getAddressesFromHd },
        getVaultSettings,
        validateAddress,
        validateXpub: jest.fn(async () => ({ isValid: true })),
        getCoreApiNetworkInfo: jest.fn(async () => ({
          networkChainCode: 'btc',
        })),
      }) as unknown as VaultBase,
  );
  jest.spyOn(vaultFactory, 'getWalletOnlyVault').mockImplementation(getVault);
  const api = {
    localDb: {
      getAllWallets,
      getCredentialSafe,
      getDeviceSafe,
      importPublicCloudAccounts: write,
      deletePublicCloudAccounts: remove,
    },
    serviceHardware: { getSDKInstance: getHardwareSDK },
    servicePassword: { getCachedPassword },
  } as unknown as IBackgroundApi;
  return {
    api,
    stored,
    write,
    remove,
    getAllWallets,
    getCredentialSafe,
    getDeviceSafe,
    prepareAccounts,
    getAddressesFromHd,
    getHardwareSDK,
    getCachedPassword,
    validateAddress,
    getVault,
    settings,
  };
}

describe('importPublicAccountSnapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([100, 1000])(
    'deletes %i remote snapshots in bounded batches without discovering accounts or producing a copy',
    async (count) => {
      const h = harness();
      const snapshots = Array.from({ length: count }, (_, index) =>
        snapshot(index),
      );
      await importPublicAccountSnapshots({
        backgroundApi: h.api,
        snapshots,
        isCurrent: () => true,
      });
      h.write.mockClear();
      const sources = new Map(
        snapshots.map((value) => {
          const id = getPublicAccountSnapshotId(value);
          return [
            id,
            {
              id,
              dataType: EPrimeCloudSyncDataType.Account,
              data: 'public-test-ciphertext',
              dataTime: 2,
              pwdHash: 'public-test-cloud',
              rawKey: '',
              rawData: '',
              isDeleted: true,
              localSceneUpdated: false,
              serverUploaded: true,
            },
          ] as const;
        }),
      );
      const params = {
        backgroundApi: h.api,
        snapshots,
        sourceItemsBySnapshotId: sources,
        action: 'delete' as const,
        isCurrent: () => true,
      };
      const result = await importPublicAccountSnapshots(params);
      expect(result).toMatchObject({ deleted: count, added: 0, pending: 0 });
      expect(h.remove).toHaveBeenCalledTimes(count / 50);
      expect(
        h.remove.mock.calls.every(
          ([value]) =>
            value.accounts.length <= 50 &&
            value.sourceItemsByAccountId.size <= 50,
        ),
      ).toBe(true);
      expect(h.write).not.toHaveBeenCalled();
      expect(h.stored.size).toBe(0);
      expect(h.prepareAccounts).not.toHaveBeenCalled();
      expect(h.getHardwareSDK).not.toHaveBeenCalled();
      expect((await importPublicAccountSnapshots(params)).unchanged).toBe(
        count,
      );
    },
  );

  it('does not delete without an authenticated pool source and never discovers a missing wallet', async () => {
    const h = harness();
    const value = snapshot();
    expect(
      await importPublicAccountSnapshots({
        backgroundApi: h.api,
        snapshots: [value],
        action: 'delete',
        isCurrent: () => true,
      }),
    ).toMatchObject({ deleted: 0, pending: 1 });
    expect(h.remove).not.toHaveBeenCalled();
    const missing = harness([]);
    expect(
      await importPublicAccountSnapshots({
        backgroundApi: missing.api,
        snapshots: [value],
        action: 'delete',
        isCurrent: () => true,
      }),
    ).toMatchObject({ deleted: 0, pending: 1 });
    expect(missing.getVault).not.toHaveBeenCalled();
    expect(missing.getHardwareSDK).not.toHaveBeenCalled();
  });

  it.each([100, 1000])(
    'copies %i accounts in batches of at most 50 without hardware interaction',
    async (count) => {
      const h = harness();
      const result = await importPublicAccountSnapshots({
        backgroundApi: h.api,
        snapshots: Array.from({ length: count }, (_, index) => snapshot(index)),
        isCurrent: () => true,
      });
      expect(result).toMatchObject({ added: count, pending: 0, conflicts: 0 });
      expect(result.appliedSnapshotIds).toHaveLength(count);
      expect(h.write).toHaveBeenCalledTimes(count / 50);
      expect(
        h.write.mock.calls.every(([params]) => params.accounts.length <= 50),
      ).toBe(true);
      expect(h.getAllWallets).toHaveBeenCalledTimes(1);
      expect(h.getDeviceSafe).toHaveBeenCalledTimes(1);
      expect(h.prepareAccounts).not.toHaveBeenCalled();
      expect(h.getAddressesFromHd).not.toHaveBeenCalled();
      expect(h.getHardwareSDK).not.toHaveBeenCalled();
      expect(h.stored.values().next().value).toMatchObject({
        id: "hw-local-device--m/44'/60'/0'/0/0",
        indexedAccountId: 'hw-local-device--0',
      });
    },
  );

  it('does no credential lookup, calculation or writes for 1000 unrelated wallets/accounts', async () => {
    const h = harness(
      Array.from({ length: 1000 }, (_, index) => ({
        ...wallet('hd'),
        id: `hd-${index}`,
        xfp: `${(index + 1).toString(16).padStart(8, '0')}--${XPUB}`,
      })),
    );
    const result = await importPublicAccountSnapshots({
      backgroundApi: h.api,
      snapshots: Array.from({ length: 1000 }, (_, index) =>
        snapshot(index, 'hd'),
      ),
      isCurrent: () => true,
    });
    expect(result).toMatchObject({ added: 0, pending: 1000 });
    expect(h.getAllWallets).toHaveBeenCalledTimes(1);
    expect(h.getCredentialSafe).not.toHaveBeenCalled();
    expect(h.getVault).not.toHaveBeenCalled();
    expect(h.prepareAccounts).not.toHaveBeenCalled();
    expect(h.getAddressesFromHd).not.toHaveBeenCalled();
    expect(h.write).not.toHaveBeenCalled();
  });

  it('copies HD/Keyless public records using the existing local credential without password or derivation', async () => {
    const keyless = { ...wallet('hd'), id: 'hd-keyless-local' };
    const h = harness([keyless]);
    const result = await importPublicAccountSnapshots({
      backgroundApi: h.api,
      snapshots: Array.from({ length: 100 }, (_, index) =>
        snapshot(index, 'hd'),
      ),
      isCurrent: () => true,
    });
    expect(result.added).toBe(100);
    expect(h.getCredentialSafe).toHaveBeenCalledTimes(1);
    expect(h.getCachedPassword).not.toHaveBeenCalled();
    expect(h.prepareAccounts).not.toHaveBeenCalled();
    expect(h.getAddressesFromHd).not.toHaveBeenCalled();
    expect(h.getHardwareSDK).not.toHaveBeenCalled();
  });

  it('keeps missing software credentials pending and retries afresh next round', async () => {
    const h = harness([wallet('hd')]);
    h.getCredentialSafe.mockResolvedValueOnce(undefined);
    const params = {
      backgroundApi: h.api,
      snapshots: Array.from({ length: 100 }, (_, index) =>
        snapshot(index, 'hd'),
      ),
      isCurrent: () => true,
    };
    expect(await importPublicAccountSnapshots(params)).toMatchObject({
      added: 0,
      pending: 100,
    });
    expect(h.getCredentialSafe).toHaveBeenCalledTimes(1);
    expect(h.write).not.toHaveBeenCalled();
    expect((await importPublicAccountSnapshots(params)).added).toBe(100);
    expect(h.getCredentialSafe).toHaveBeenCalledTimes(2);
  });

  it('does not cross wallet kind or silently choose duplicate local wallets', async () => {
    const h = harness([wallet('hd'), { ...wallet('hd'), id: 'hd-duplicate' }]);
    expect(
      await importPublicAccountSnapshots({
        backgroundApi: h.api,
        snapshots: [snapshot(), snapshot(0, 'hd')],
        isCurrent: () => true,
      }),
    ).toMatchObject({ pending: 2, added: 0, appliedSnapshotIds: [] });
    expect(h.getCredentialSafe).not.toHaveBeenCalled();
    expect(h.write).not.toHaveBeenCalled();
  });

  it('keeps hidden-wallet ownership and never uses a standard wallet for a hidden snapshot', async () => {
    const hidden = snapshot();
    hidden.wallet.hidden = true;
    const h = harness();
    expect(
      await importPublicAccountSnapshots({
        backgroundApi: h.api,
        snapshots: [hidden],
        isCurrent: () => true,
      }),
    ).toMatchObject({ pending: 1 });
    const local = {
      ...wallet(),
      id: 'hw-local-device-hidden',
      passphraseState: 'local-hidden-state',
    };
    const matching = harness([local]);
    expect(
      await importPublicAccountSnapshots({
        backgroundApi: matching.api,
        snapshots: [hidden],
        isCurrent: () => true,
      }),
    ).toMatchObject({ added: 1 });
    expect(matching.write.mock.calls[0][0].expectedWallet).toMatchObject({
      associatedDevice: 'local-device',
      passphraseState: 'local-hidden-state',
      hidden: true,
    });
  });

  it('is idempotent, reports conflicts and applies only successful snapshot IDs', async () => {
    const h = harness();
    const first = snapshot();
    const next = snapshot(1);
    const params = {
      backgroundApi: h.api,
      snapshots: [first],
      isCurrent: () => true,
    };
    expect((await importPublicAccountSnapshots(params)).added).toBe(1);
    expect((await importPublicAccountSnapshots(params)).unchanged).toBe(1);
    const conflicting = snapshot();
    conflicting.account.address = '0x2222222222222222222222222222222222222222';
    const result = await importPublicAccountSnapshots({
      ...params,
      snapshots: [conflicting, next],
    });
    expect(result).toMatchObject({ added: 1, conflicts: 1 });
    expect(result.appliedSnapshotIds).toEqual([
      getPublicAccountSnapshotId(next),
    ]);
    expect(h.stored.get("hw-local-device--m/44'/60'/0'/0/0")?.address).toBe(
      first.account.address,
    );
  });

  it('does not choose the first of conflicting snapshots for a missing path', async () => {
    const h = harness();
    const conflicting = snapshot();
    conflicting.account.address = '0x2222222222222222222222222222222222222222';
    expect(
      await importPublicAccountSnapshots({
        backgroundApi: h.api,
        snapshots: [snapshot(), conflicting],
        isCurrent: () => true,
      }),
    ).toMatchObject({ added: 0, conflicts: 2, appliedSnapshotIds: [] });
    expect(h.write).not.toHaveBeenCalled();
  });

  it('stops before writes when lock or selected Cloud key changes during validation', async () => {
    const h = harness();
    let current = true;
    h.validateAddress.mockImplementation(async (address) => {
      current = false;
      return { isValid: true, normalizedAddress: address };
    });
    expect(
      await importPublicAccountSnapshots({
        backgroundApi: h.api,
        snapshots: [snapshot()],
        isCurrent: () => current,
      }),
    ).toMatchObject({ cancelled: true, added: 0, appliedSnapshotIds: [] });
    expect(h.write).not.toHaveBeenCalled();
  });

  it('keeps third-party hardware and future schemas pending', async () => {
    const h = harness();
    h.getDeviceSafe.mockResolvedValue({ vendor: EHardwareVendor.ledger });
    expect(
      await importPublicAccountSnapshots({
        backgroundApi: h.api,
        snapshots: [snapshot(), { ...snapshot(1), version: 2 }],
        isCurrent: () => true,
      }),
    ).toMatchObject({ pending: 2, added: 0 });
    expect(h.write).not.toHaveBeenCalled();
  });

  it.each([
    {
      purpose: 49,
      encoding: EAddressEncodings.P2SH_P2WPKH,
      prefix: 'ypub',
      script: 'SPENDP2SHWITNESS',
    },
    {
      purpose: 84,
      encoding: EAddressEncodings.P2WPKH,
      prefix: 'zpub',
      script: 'SPENDWITNESS',
    },
  ])(
    'copies real software and locked-SDK batch BIP$purpose public formats without receiving-side creation',
    async ({ purpose, encoding, prefix, script }) => {
      const networkInfo = {
        networkChainCode: 'btc',
        chainId: '0',
        networkId: 'btc--0',
        networkImpl: 'btc',
        isTestnet: false,
      };
      const template = `m/${purpose}'/0'/$$INDEX$$'/0/0`;
      const { hdCredential } = coreTestsFixtures.prepareCoreChainTestsFixtures({
        networkInfo,
        hdAccountTemplate: template,
        hdAccounts: [],
        txSamples: [],
        msgSamples: [],
      });
      const core = new CoreChainHd();
      const {
        addresses: [generated],
      } = await core.getAddressesFromHd({
        networkInfo,
        template,
        indexes: [0],
        addressEncoding: encoding,
        hdCredential: hdCredential.hdCredentialHex,
        password: hdCredential.password,
      });
      const xpub = generated.xpub;
      const path = generated.path;
      if (!xpub || !path)
        throw new OneKeyLocalError(
          'Missing synthetic public account key or path',
        );
      expect(xpub.startsWith(prefix)).toBe(true);
      // Execute the exact installed SDK public-node formatter in isolation, as
      // the existing SDK redaction tests do. No SDK/device instance is created.
      const bundle = readFileSync(require.resolve('@onekeyfe/hd-core'), 'utf8');
      const start = bundle.indexOf('const VERSION_BYTES =');
      const end = bundle.indexOf('class BTCGetPublicKey ', start);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      const createExtendedPublicKey = runInNewContext(
        `${bundle.slice(start, end)}\ncreateExtendedPublicKey;`,
        {
          Buffer,
          sha256: {
            sha256: (bytes: Uint8Array) =>
              createHash('sha256').update(bytes).digest(),
          },
        },
      ) as (
        node: {
          depth: number;
          fingerprint: number;
          child_num: number;
          chain_code: string;
          public_key: string;
        },
        coin: string,
        scriptType: string,
      ) => string;
      const node = getBip32FromBase58({
        network: getBtcForkNetwork('btc'),
        key: xpub,
      });
      const batchXpub = createExtendedPublicKey(
        {
          depth: node.depth,
          fingerprint: node.parentFingerprint,
          child_num: node.index,
          chain_code: node.chainCode.toString('hex'),
          public_key: node.publicKey.toString('hex'),
        },
        'Bitcoin',
        script,
      );
      expect(batchXpub).toBe(xpub);
      for (const kind of ['hd', 'hardware'] as const) {
        const h = harness([wallet(kind)]);
        const btc = snapshot(0, kind);
        const publicKey = kind === 'hd' ? xpub : batchXpub;
        btc.account = {
          impl: 'btc',
          type: 'utxo',
          networkId: 'btc--0',
          coinType: '0',
          path,
          pathIndex: 0,
          template,
          name: 'Public BTC fixture',
          address: generated.address,
          pub: generated.publicKey,
          xpub: publicKey,
          xpubSegwit: publicKey,
          relPath: '0/0',
          addresses: { '0/0': generated.address },
        };
        const sourceAccount = publicAccountSnapshotToAccount(
          btc,
          wallet(kind).id,
        );
        const built = buildPublicAccountSnapshot({
          wallet: wallet(kind),
          account: sourceAccount,
        });
        expect(built?.account.xpub).toBe(publicKey);
        h.settings.impl = 'btc';
        h.settings.accountDeriveInfo.default = {
          template,
          coinType: '0',
          namePrefix: 'BTC',
          addressEncoding: encoding,
        };
        jest
          .spyOn(coreChainApi.btc.hd, 'getAddressFromXpub')
          .mockImplementation((params) => core.getAddressFromXpub(params));
        expect(
          await importPublicAccountSnapshots({
            backgroundApi: h.api,
            snapshots: [built],
            isCurrent: () => true,
          }),
        ).toMatchObject({ added: 1, rejected: 0 });
        expect(h.prepareAccounts).not.toHaveBeenCalled();
        expect(h.getAddressesFromHd).not.toHaveBeenCalled();
        expect(h.getHardwareSDK).not.toHaveBeenCalled();
        const withAccount = (
          patch: Partial<ICloudPublicAccountSnapshot['account']>,
        ) => ({ ...btc, account: { ...btc.account, ...patch } });
        expect(() =>
          normalizePublicAccountSnapshot(
            withAccount({ pathIndex: 1, path: `m/${purpose}'/0'/1'` }),
          ),
        ).toThrow();
        expect(() =>
          normalizePublicAccountSnapshot(
            withAccount({
              xpub: `${publicKey.slice(0, -1)}${publicKey.endsWith('1') ? '2' : '1'}`,
            }),
          ),
        ).toThrow();
        const wrongPurpose = purpose === 49 ? 84 : 49;
        expect(() =>
          normalizePublicAccountSnapshot(
            withAccount({
              path: `m/${wrongPurpose}'/0'/0'`,
              template: `m/${wrongPurpose}'/0'/$$INDEX$$'/0/0`,
            }),
          ),
        ).toThrow();
        expect(() =>
          normalizePublicAccountSnapshot(
            withAccount({
              xpub: node.derive(0).toBase58(),
              xpubSegwit: node.derive(0).toBase58(),
            }),
          ),
        ).toThrow();
        expect(() =>
          normalizePublicAccountSnapshot(
            withAccount({ xpub: `xprv${publicKey.slice(4)}` }),
          ),
        ).toThrow();
        const testnet = convertBtcForkXpub({
          btcForkNetwork: getBtcForkNetwork('tbtc'),
          xpub: publicKey,
          addressEncoding: EAddressEncodings.P2PKH,
        });
        expect(() =>
          normalizePublicAccountSnapshot(
            withAccount({ xpub: testnet, xpubSegwit: testnet }),
          ),
        ).toThrow();
        const canonical = convertBtcForkXpub({
          btcForkNetwork: getBtcForkNetwork('btc'),
          xpub: publicKey,
          addressEncoding: EAddressEncodings.P2PKH,
        });
        expect(
          normalizePublicAccountSnapshot(
            withAccount({ xpub: canonical, xpubSegwit: canonical }),
          ).account.xpub,
        ).toBe(canonical);
        const wrongAddress = withAccount({
          address: 'bc1qwrong',
          addresses: { '0/0': 'bc1qwrong' },
        });
        expect(
          await importPublicAccountSnapshots({
            backgroundApi: h.api,
            snapshots: [wrongAddress],
            isCurrent: () => true,
          }),
        ).toMatchObject({ rejected: 1 });
      }
    },
  );

  it.each([84, 86])(
    'checks BTC BIP%i xpub/address and descriptor consistency using only public data',
    async (purpose) => {
      const kind = purpose === 86 ? 'hd' : 'hardware';
      const h = harness([wallet(kind)]);
      const btc = snapshot(0, kind);
      btc.account = {
        impl: 'btc',
        type: 'utxo',
        networkId: 'btc--0',
        coinType: '0',
        path: `m/${purpose}'/0'/0'`,
        pathIndex: 0,
        template: `m/${purpose}'/0'/$$INDEX$$'/0/0`,
        name: 'BTC',
        address: 'bc1qpux3z758ulsxg69eptaakukraanqwtdxe5yy4c',
        pub: '',
        xpub: XPUB,
        xpubSegwit:
          purpose === 86 ? `tr([12345678/86'/0'/0']${XPUB}/<0;1>/*)` : XPUB,
        relPath: '0/0',
        addresses: { '0/0': 'bc1qpux3z758ulsxg69eptaakukraanqwtdxe5yy4c' },
      };
      h.settings.impl = 'btc';
      h.settings.accountDeriveInfo.default = {
        template: btc.account.template,
        coinType: '0',
        namePrefix: 'BTC',
        addressEncoding: undefined,
      };
      const getPublic = jest.fn(async () => ({
        addresses: { '0/0': btc.account.address },
        publicKeys: { '0/0': '' },
        xpubSegwit: purpose === 86 ? `tr(${XPUB})` : XPUB,
      }));
      jest
        .spyOn(coreChainApi.btc.hd, 'getAddressFromXpub')
        .mockImplementation(getPublic);
      expect(
        await importPublicAccountSnapshots({
          backgroundApi: h.api,
          snapshots: [btc],
          isCurrent: () => true,
        }),
      ).toMatchObject({ added: 1 });
      expect(getPublic).toHaveBeenCalledTimes(1);
      expect(h.prepareAccounts).not.toHaveBeenCalled();
      expect(h.getHardwareSDK).not.toHaveBeenCalled();
      const wrongIndex = {
        ...btc,
        account: { ...btc.account, pathIndex: 1, path: `m/${purpose}'/0'/1'` },
      };
      expect(
        await importPublicAccountSnapshots({
          backgroundApi: h.api,
          snapshots: [wrongIndex],
          isCurrent: () => true,
        }),
      ).toMatchObject({ rejected: 1, appliedSnapshotIds: [] });
      expect(getPublic).toHaveBeenCalledTimes(1);
      getPublic.mockResolvedValue({
        addresses: { '0/0': 'different-address' },
        publicKeys: { '0/0': '' },
        xpubSegwit: XPUB,
      });
      expect(
        await importPublicAccountSnapshots({
          backgroundApi: h.api,
          snapshots: [btc],
          isCurrent: () => true,
        }),
      ).toMatchObject({ rejected: 1, appliedSnapshotIds: [] });
    },
  );
});
