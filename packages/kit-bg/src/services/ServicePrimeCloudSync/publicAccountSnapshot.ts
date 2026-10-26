import bs58 from 'bs58';

import {
  getBip32FromBase58,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { normalizeFullWalletXfp } from '@onekeyhq/shared/src/utils/walletXfpUtils';
import type { ICloudPublicAccountSnapshot } from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { EDBAccountType } from '../../dbs/local/consts';

import { PublicAccountSnapshotUnsupportedError } from './publicAccountSnapshotErrors';
import {
  isPublicAccountSnapshotImpl,
  normalizePublicAccountSnapshotV2,
} from './publicAccountSnapshotV2';

import type { IDBAccount, IDBWallet } from '../../dbs/local/types';

export { PublicAccountSnapshotUnsupportedError } from './publicAccountSnapshotErrors';

export const PUBLIC_ACCOUNT_SNAPSHOT_PREFIX = 'cloud-public-account:';
export const PUBLIC_ACCOUNT_SNAPSHOT_MAX_BYTES = 16 * 1024;
export const PUBLIC_ACCOUNT_IMPORT_BATCH_SIZE = 50;
export const normalizePublicAccountWalletXfp = normalizeFullWalletXfp;

export function getPublicAccountSnapshotTaprootDescriptor({
  walletXfp,
  path,
  xpub,
}: {
  walletXfp: string;
  path: string;
  xpub: string;
}): string {
  const fingerprint = normalizePublicAccountWalletXfp(walletXfp).split('--')[0];
  return `tr([${fingerprint}${path.substring(1)}]${xpub}/<0;1>/*)`;
}

function invalid(): never {
  throw new OneKeyLocalError('Invalid public account snapshot');
}

function object(value: unknown, keys?: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  const result = value as Record<string, unknown>;
  let count = 0;
  for (const key in result) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      count += 1;
      if (count > 64 || (keys && !keys.includes(key))) return invalid();
    }
  }
  return result;
}

function text(value: unknown, max: number, allowEmpty = false): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (!allowEmpty && !value) ||
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 &&
        ![9, 10, 13].includes(character.charCodeAt(0)),
    )
  )
    return invalid();
  return value;
}

const templates: Record<string, Record<string, string | undefined>> = {
  evm: {
    "m/44'/60'/0'/0/$$INDEX$$": undefined,
    "m/44'/60'/$$INDEX$$'/0/0": 'LedgerLive',
    "m/44'/60'/0'/$$INDEX$$": 'LedgerLegacy',
  },
  sol: {
    "m/44'/501'/$$INDEX$$'/0'": undefined,
    "m/44'/501'/$$INDEX$$'": undefined,
  },
  btc: Object.fromEntries(
    [44, 49, 84, 86].map((purpose) => [
      `m/${purpose}'/0'/$$INDEX$$'/0/0`,
      undefined,
    ]),
  ),
};

function normalizeNetworks(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 16) return invalid();
  return Array.from(new Set(value.map((item) => text(item, 128)))).toSorted();
}

export function normalizePublicAccountSnapshot(
  value: unknown,
): ICloudPublicAccountSnapshot {
  const root = object(value);
  if (root.version === 2) {
    if (
      root.schema !== 'onekey-public-account' ||
      !Array.isArray(root.capabilities) ||
      root.capabilities.length !== 1 ||
      root.capabilities[0] !== 'account-copy-v2'
    )
      throw new PublicAccountSnapshotUnsupportedError();
    return normalizePublicAccountSnapshotV2(root);
  }
  if (root.schema !== 'onekey-public-account' || root.version !== 1)
    throw new PublicAccountSnapshotUnsupportedError();
  if (
    !Array.isArray(root.capabilities) ||
    root.capabilities.length !== 1 ||
    root.capabilities[0] !== 'account-copy-v1'
  )
    throw new PublicAccountSnapshotUnsupportedError();
  object(root, ['schema', 'version', 'capabilities', 'wallet', 'account']);
  const wallet = object(root.wallet, ['kind', 'xfp', 'hidden']);
  if (
    (wallet.kind !== 'hardware' && wallet.kind !== 'hd') ||
    typeof wallet.hidden !== 'boolean' ||
    (wallet.kind === 'hd' && wallet.hidden)
  )
    return invalid();
  const a = object(root.account, [
    'impl',
    'type',
    'networkId',
    'coinType',
    'path',
    'pathIndex',
    'template',
    'idSuffix',
    'name',
    'address',
    'pub',
    'xpub',
    'xpubSegwit',
    'relPath',
    'addresses',
    'networks',
    'createAtNetwork',
  ]);
  if (a.impl !== 'btc' && a.impl !== 'evm' && a.impl !== 'sol')
    throw new PublicAccountSnapshotUnsupportedError();
  const impl = a.impl;
  const template = text(a.template, 128);
  if (!Object.prototype.hasOwnProperty.call(templates[impl], template))
    throw new PublicAccountSnapshotUnsupportedError();
  const idSuffix = a.idSuffix === undefined ? undefined : text(a.idSuffix, 64);
  if (idSuffix !== templates[impl][template]) return invalid();
  if (
    !Number.isSafeInteger(a.pathIndex) ||
    Number(a.pathIndex) < 0 ||
    Number(a.pathIndex) > 0x7f_ff_ff_ff
  )
    return invalid();
  const pathIndex = a.pathIndex as number;
  const expectedPath = accountUtils.buildPathFromTemplate({
    template,
    index: pathIndex,
  });
  const path = text(a.path, 128);
  if (
    path !==
    (impl === 'btc' ? expectedPath.replace(/\/0\/0$/, '') : expectedPath)
  )
    return invalid();
  const networkId = text(a.networkId, 128);
  const networkMap = getNetworkIdsMap();
  if (
    (impl === 'evm' && !/^evm--\d+$/.test(networkId)) ||
    (impl === 'btc' && networkId !== networkMap.btc) ||
    (impl === 'sol' && networkId !== networkMap.sol)
  )
    throw new PublicAccountSnapshotUnsupportedError();
  const coinType = text(a.coinType, 8);
  if (coinType !== { btc: '0', evm: '60', sol: '501' }[impl]) return invalid();
  if (a.type !== (impl === 'btc' ? 'utxo' : 'simple')) return invalid();
  const address = text(a.address, 256);
  const pub = text(a.pub, 256, true);
  if (
    (impl === 'evm' && !/^0x[\da-f]{40}$/i.test(address)) ||
    (impl === 'sol' && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))
  )
    return invalid();
  if (
    pub &&
    !(
      impl === 'sol'
        ? /^[\da-f]{64}$/i
        : /^(02|03)[\da-f]{64}$|^04[\da-f]{128}$/i
    ).test(pub)
  )
    return invalid();
  const networks = normalizeNetworks(a.networks);
  const createAtNetwork =
    a.createAtNetwork === undefined ? undefined : text(a.createAtNetwork, 128);
  for (const id of [
    ...(networks ?? []),
    ...(createAtNetwork ? [createAtNetwork] : []),
  ]) {
    if (impl === 'evm' ? !/^evm--\d+$/.test(id) : id !== networkId)
      return invalid();
  }
  const account: ICloudPublicAccountSnapshot['account'] = {
    impl,
    type: impl === 'btc' ? 'utxo' : 'simple',
    networkId,
    coinType,
    path,
    pathIndex,
    template,
    idSuffix,
    name: text(a.name, 256, true),
    address,
    pub,
    networks,
    createAtNetwork,
  };
  if (impl === 'btc') {
    account.xpub = text(a.xpub, 120);
    if (!/^(xpub|ypub|zpub)[1-9A-HJ-NP-Za-km-z]{100,116}$/.test(account.xpub))
      return invalid();
    if (
      (account.xpub.startsWith('ypub') && !template.startsWith("m/49'/")) ||
      (account.xpub.startsWith('zpub') && !template.startsWith("m/84'/"))
    )
      return invalid();
    try {
      const node = getBip32FromBase58({
        network: getBtcForkNetwork('btc'),
        key: account.xpub,
      });
      if (
        !node.isNeutered() ||
        node.depth !== 3 ||
        node.index !== 0x80_00_00_00 + pathIndex
      )
        return invalid();
    } catch (_error) {
      return invalid();
    }
    account.xpubSegwit =
      a.xpubSegwit === undefined ? undefined : text(a.xpubSegwit, 256);
    const isTaproot = template.startsWith("m/86'/");
    const bareDescriptor = isTaproot ? `tr(${account.xpub})` : account.xpub;
    if (
      (isTaproot && !account.xpubSegwit) ||
      (account.xpubSegwit &&
        account.xpubSegwit !== bareDescriptor &&
        !(
          isTaproot &&
          account.xpubSegwit ===
            getPublicAccountSnapshotTaprootDescriptor({
              walletXfp: text(wallet.xfp, 256),
              path,
              xpub: account.xpub,
            })
        ))
    )
      return invalid();
    account.relPath = text(a.relPath, 32);
    if (
      !/^[01]\/\d{1,10}$/.test(account.relPath) ||
      Number(account.relPath.split('/')[1]) > 0x7f_ff_ff_ff
    )
      return invalid();
    const addresses = object(a.addresses);
    if (Object.keys(addresses).length > 64) return invalid();
    account.addresses = {};
    for (const [key, item] of Object.entries(addresses)) {
      if (
        !/^[01]\/\d{1,10}$/.test(key) ||
        Number(key.split('/')[1]) > 0x7f_ff_ff_ff
      )
        return invalid();
      account.addresses[key] = text(item, 128);
    }
    if (account.addresses[account.relPath] !== address) return invalid();
  } else if (
    a.xpub !== undefined ||
    a.xpubSegwit !== undefined ||
    a.relPath !== undefined ||
    a.addresses !== undefined
  )
    return invalid();
  const result: ICloudPublicAccountSnapshot = {
    schema: 'onekey-public-account',
    version: 1,
    capabilities: ['account-copy-v1'],
    wallet: {
      kind: wallet.kind,
      xfp: normalizeFullWalletXfp(text(wallet.xfp, 140)),
      hidden: wallet.hidden,
    },
    account,
  };
  if (
    Buffer.byteLength(stringUtils.stableStringify(result), 'utf8') >
    PUBLIC_ACCOUNT_SNAPSHOT_MAX_BYTES
  )
    return invalid();
  return result;
}

export function getPublicAccountSnapshotId(
  snapshot: ICloudPublicAccountSnapshot,
): string {
  const { wallet, account } = normalizePublicAccountSnapshot(snapshot);
  const identity = {
    wallet,
    impl: account.impl,
    networkScope: account.networks ?? [],
    template: account.template,
    path: account.path,
    pathIndex: account.pathIndex,
    idSuffix: account.idSuffix,
  };
  const identityVersion = ['btc', 'evm', 'sol'].includes(account.impl)
    ? 1
    : snapshot.version;
  return `${PUBLIC_ACCOUNT_SNAPSHOT_PREFIX}v${identityVersion}:${Buffer.from(appCrypto.hash.sha256Sync(Buffer.from(stringUtils.stableStringify(identity), 'utf8'))).toString('hex')}`;
}

export function normalizePublicAccountSnapshotRecord(value: unknown) {
  const record = object(value);
  const payload = object(record.payload);
  const snapshot = normalizePublicAccountSnapshot(
    payload.publicAccountSnapshot,
  );
  object(record, ['dataType', 'rawKey', 'payload']);
  object(payload, ['name', 'accountId', 'publicAccountSnapshot']);
  const accountId = getPublicAccountSnapshotId(snapshot);
  const rawKey = `Account >> ${accountId}`;
  if (
    record.dataType !== 'Account' ||
    record.rawKey !== rawKey ||
    payload.accountId !== accountId ||
    payload.name !== snapshot.account.name
  )
    return invalid();
  return {
    rawKey,
    snapshot,
    payload: {
      name: snapshot.account.name,
      accountId,
      publicAccountSnapshot: snapshot,
    },
  };
}

export function publicAccountSnapshotToAccount(
  snapshot: ICloudPublicAccountSnapshot,
  walletId: string,
): IDBAccount {
  const { account: a } = normalizePublicAccountSnapshot(snapshot);
  let id = accountUtils.buildHDAccountId({
    walletId,
    path: a.path,
    idSuffix: a.idSuffix,
    isUtxo: a.type === 'utxo',
  });
  if (a.impl === 'lightning' || a.impl === 'tlightning') {
    id = accountUtils.buildLightningAccountId({
      accountId: id,
      isTestnet: a.impl === 'tlightning',
    });
  }
  const base = {
    id,
    name: a.name,
    impl: a.impl,
    coinType: a.coinType,
    path: a.path,
    pathIndex: a.pathIndex,
    template: a.template,
    indexedAccountId: accountUtils.buildIndexedAccountId({
      walletId,
      index: a.pathIndex,
    }),
    address: a.address,
    pub: a.pub,
    networks: a.networks,
    createAtNetwork: a.createAtNetwork,
    ...(snapshot.version === 2 && a.relPath !== undefined
      ? { relPath: a.relPath }
      : {}),
    ...(snapshot.version === 2 && a.xpub !== undefined ? { xpub: a.xpub } : {}),
    ...(snapshot.version === 2 && a.xpubSegwit !== undefined
      ? { xpubSegwit: a.xpubSegwit }
      : {}),
  };
  if (a.type === 'utxo')
    return {
      ...base,
      type: EDBAccountType.UTXO,
      xpub: a.xpub ?? '',
      xpubSegwit: a.xpubSegwit,
      relPath: a.relPath,
      addresses: { ...a.addresses },
    };
  if (a.type === 'variant')
    return {
      ...base,
      type: EDBAccountType.VARIANT,
      addresses: { ...a.addresses },
    };
  return {
    ...base,
    type: EDBAccountType.SIMPLE,
    ...(snapshot.version === 2 && a.addresses
      ? { addresses: { ...a.addresses } }
      : {}),
  };
}

export function publicAccountIdentityEqual(
  a: IDBAccount,
  b: IDBAccount,
): boolean {
  const project = (account: IDBAccount) => {
    let xpub = 'xpub' in account ? account.xpub : undefined;
    if (!['btc', 'evm', 'sol'].includes(account.impl)) xpub ??= '';
    let pub = account.pub ?? '';
    if (account.impl === 'sol' && pub && !/^[\da-f]{64}$/i.test(pub)) {
      try {
        const decoded = bs58.decode(pub);
        if (decoded.length === 32) pub = Buffer.from(decoded).toString('hex');
      } catch {
        // Preserve malformed metadata exactly rather than folding distinct keys.
      }
    } else if (
      /^(0x)?([\da-f]{64}|(02|03)[\da-f]{64}|04[\da-f]{128})$/i.test(pub)
    )
      pub = pub.toLowerCase();
    return {
      impl: account.impl,
      type: account.type,
      path: account.path,
      pathIndex: account.pathIndex,
      template: account.template,
      idSuffix: accountUtils.parseAccountId({ accountId: account.id }).idSuffix,
      coinType: account.coinType,
      address:
        account.impl === 'evm'
          ? account.address.toLowerCase()
          : account.address,
      pub,
      xpub,
      ...(!['btc', 'evm', 'sol'].includes(account.impl)
        ? {
            relPath: account.relPath,
            addresses: 'addresses' in account ? (account.addresses ?? {}) : {},
            xpubSegwit:
              'xpubSegwit' in account ? (account.xpubSegwit ?? '') : '',
          }
        : {}),
      networks: account.networks ? [...account.networks].toSorted() : [],
      createAtNetwork: account.createAtNetwork,
    };
  };
  return (
    stringUtils.stableStringify(project(a)) ===
    stringUtils.stableStringify(project(b))
  );
}

export function buildPublicAccountSnapshot({
  wallet,
  account,
}: {
  wallet: IDBWallet;
  account: IDBAccount;
}): ICloudPublicAccountSnapshot | undefined {
  let kind: ICloudPublicAccountSnapshot['wallet']['kind'] | undefined;
  if (accountUtils.isHwWallet({ walletId: wallet.id })) kind = 'hardware';
  else if (
    accountUtils.isHdWallet({ walletId: wallet.id }) &&
    !accountUtils.isBotWallet({ walletId: wallet.id })
  )
    kind = 'hd';
  if (!kind || !wallet.xfp || !isPublicAccountSnapshotImpl(account.impl))
    return undefined;
  const map = getNetworkIdsMap();
  const networkId =
    account.createAtNetwork ||
    account.networks?.[0] ||
    ('addresses' in account
      ? Object.keys(account.addresses ?? {}).find((id) =>
          id.startsWith(`${account.impl}--`),
        )
      : undefined) ||
    ({ btc: map.btc, evm: map.eth, sol: map.sol } as Record<string, string>)[
      account.impl
    ] ||
    Object.values(map).find((id) => id.startsWith(`${account.impl}--`));
  const { idSuffix } = accountUtils.parseAccountId({ accountId: account.id });
  const raw = {
    schema: 'onekey-public-account',
    version: 1,
    capabilities: ['account-copy-v1'],
    wallet: {
      kind,
      xfp: wallet.xfp,
      hidden: kind === 'hardware' && !!wallet.passphraseState,
    },
    account: {
      impl: account.impl,
      type: account.type,
      networkId,
      coinType: account.coinType,
      path: account.path,
      pathIndex: account.pathIndex,
      template: account.template,
      idSuffix,
      name: account.name,
      address: account.address,
      pub: account.pub || '',
      ...('xpub' in account
        ? {
            xpub: account.xpub,
            xpubSegwit: account.xpubSegwit,
            relPath: account.relPath,
            addresses: account.addresses,
          }
        : {}),
      networks: account.networks,
      createAtNetwork: account.createAtNetwork,
    },
  };
  if (['btc', 'evm', 'sol'].includes(account.impl)) {
    try {
      return normalizePublicAccountSnapshot(raw);
    } catch (_error) {
      /* A supported test/custom network may require v2. */
    }
  }
  return normalizePublicAccountSnapshot({
    ...raw,
    version: 2,
    capabilities: ['account-copy-v2'],
    account: {
      ...raw.account,
      ...(account.relPath !== undefined ? { relPath: account.relPath } : {}),
      ...('addresses' in account && account.addresses !== undefined
        ? { addresses: account.addresses }
        : {}),
    },
  });
}
