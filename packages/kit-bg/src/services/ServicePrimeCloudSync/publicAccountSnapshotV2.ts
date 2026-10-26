import { EAddressEncodings } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { normalizeFullWalletXfp } from '@onekeyhq/shared/src/utils/walletXfpUtils';
import type {
  ICloudPublicAccountImpl,
  ICloudPublicAccountSnapshot,
} from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { PublicAccountSnapshotUnsupportedError } from './publicAccountSnapshotErrors';

type IChainPolicy = {
  coinType: string;
  type: 'simple' | 'utxo' | 'variant';
  templates: Record<string, string | undefined>;
  hardwareOnly?: boolean;
};
const index = '$$INDEX$$';
const policy = (
  coinType: string,
  template: string,
  type: IChainPolicy['type'] = 'simple',
  hardwareOnly = false,
): IChainPolicy => ({
  coinType,
  type,
  templates: { [template]: undefined },
  hardwareOnly,
});
const utxoPolicy = (coinType: string, purposes: number[]): IChainPolicy => ({
  coinType,
  type: 'utxo',
  templates: Object.fromEntries(
    purposes.map((p) => [`m/${p}'/${coinType}'/${index}'/0/0`, undefined]),
  ),
});

// Deliberately mirrors actual Vault settings, not SUPPORTED_IMPLS (which also
// contains unregistered/virtual entries). A registry regression detects drift.
export const PUBLIC_ACCOUNT_CHAIN_POLICIES: Record<
  ICloudPublicAccountImpl,
  IChainPolicy
> = {
  btc: utxoPolicy('0', [44, 49, 84, 86]),
  tbtc: utxoPolicy('1', [44, 49, 84, 86]),
  ltc: utxoPolicy('2', [44, 49, 84]),
  doge: utxoPolicy('3', [44]),
  bch: utxoPolicy('145', [44]),
  neurai: utxoPolicy('1900', [44]),
  evm: {
    coinType: '60',
    type: 'simple',
    templates: {
      [`m/44'/60'/0'/0/${index}`]: undefined,
      [`m/44'/60'/${index}'/0/0`]: 'LedgerLive',
      [`m/44'/60'/0'/${index}`]: 'LedgerLegacy',
    },
  },
  sol: {
    coinType: '501',
    type: 'simple',
    templates: {
      [`m/44'/501'/${index}'/0'`]: undefined,
      [`m/44'/501'/${index}'`]: undefined,
    },
  },
  tron: policy('195', `m/44'/195'/0'/0/${index}`),
  xrp: policy('144', `m/44'/144'/${index}'/0/0`),
  nervos: policy('309', `m/44'/309'/0'/0/${index}`),
  algo: policy('283', `m/44'/283'/0'/0'/${index}'`),
  sui: policy('784', `m/44'/784'/${index}'/0'/0'`),
  aptos: policy('637', `m/44'/637'/${index}'/0'/0'`),
  bfc: policy('728', `m/44'/728'/${index}'/0'/0'`),
  stellar: policy('148', `m/44'/148'/${index}'`),
  cosmos: policy('118', `m/44'/118'/0'/0/${index}`, 'variant'),
  dot: policy('354', `m/44'/354'/${index}'/0'/0'`, 'variant'),
  cfx: policy('503', `m/44'/503'/0'/0/${index}`, 'variant'),
  fil: policy('461', `m/44'/461'/0'/0/${index}`, 'variant'),
  ada: policy('1815', `m/1852'/1815'/${index}'/0/0`, 'utxo'),
  nexa: policy('29223', `m/44'/29223'/${index}'/0/0`, 'utxo'),
  ton: {
    coinType: '607',
    type: 'simple',
    templates: { [`m/44'/607'/${index}'`]: EAddressEncodings.TON_V4R2 },
  },
  kaspa: {
    coinType: '111111',
    type: 'simple',
    templates: { [`m/44'/111111'/0'/0/${index}`]: undefined },
  },
  near: policy('397', `m/44'/397'/${index}'`),
  alph: policy('1234', `m/44'/1234'/${index}'`, 'simple', true),
  neo: policy('888', `m/44'/888'/0'/0/${index}`, 'simple', true),
  scdo: policy('541', `m/44'/541'/${index}'/0/0`, 'simple', true),
  dynex: policy('29538', `m/44'/29538'/0'/0'/${index}'`, 'utxo', true),
  lightning: policy('81297820149147', `m/44'/81297820149147'/${index}'/0/0`),
  tlightning: policy('81297820149140', `m/44'/81297820149140'/${index}'/0/0`),
  nostr: policy('1237', `m/44'/1237'/${index}'/0/0`),
};

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
function text(value: unknown, max = 256, empty = false): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    (!empty && !value) ||
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return invalid();
  return value;
}
export function isPublicAccountSnapshotImpl(
  value: string,
): value is ICloudPublicAccountImpl {
  return Object.prototype.hasOwnProperty.call(
    PUBLIC_ACCOUNT_CHAIN_POLICIES,
    value,
  );
}
export function isPublicAccountNetwork(impl: string, value: string): boolean {
  if (impl === 'evm' && !/^evm--\d+$/.test(value)) return false;
  return (
    value.startsWith(`${impl}--`) &&
    value.length <= 128 &&
    /^[a-z][a-z0-9]*--\S+$/.test(value) &&
    !Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}

export function normalizePublicAccountSnapshotV2(
  value: unknown,
): ICloudPublicAccountSnapshot {
  const root = object(value, [
    'schema',
    'version',
    'capabilities',
    'wallet',
    'account',
  ]);
  if (
    root.schema !== 'onekey-public-account' ||
    root.version !== 2 ||
    !Array.isArray(root.capabilities) ||
    root.capabilities.length !== 1 ||
    root.capabilities[0] !== 'account-copy-v2'
  )
    return invalid();
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
  const impl = text(a.impl, 32);
  if (!isPublicAccountSnapshotImpl(impl))
    throw new PublicAccountSnapshotUnsupportedError();
  const chain = PUBLIC_ACCOUNT_CHAIN_POLICIES[impl];
  if (chain.hardwareOnly && wallet.kind !== 'hardware') return invalid();
  if (a.type !== chain.type || a.coinType !== chain.coinType) return invalid();
  const template = text(a.template, 128);
  const idSuffix = a.idSuffix === undefined ? undefined : text(a.idSuffix, 64);
  const kaspaOfficial =
    impl === 'kaspa' && idSuffix === EAddressEncodings.KASPA_ORG;
  if (!Object.prototype.hasOwnProperty.call(chain.templates, template))
    throw new PublicAccountSnapshotUnsupportedError();
  if (!kaspaOfficial && chain.templates[template] !== idSuffix)
    return invalid();
  if (
    !Number.isSafeInteger(a.pathIndex) ||
    Number(a.pathIndex) < 0 ||
    Number(a.pathIndex) >= 2 ** 31
  )
    return invalid();
  const pathIndex = a.pathIndex as number;
  const expected = accountUtils.buildPathFromTemplate({
    template,
    index: pathIndex,
  });
  const path = text(a.path, 128);
  const accountScope =
    (chain.type === 'utxo' && impl !== 'dynex') ||
    (['lightning', 'tlightning'].includes(impl) && wallet.kind === 'hardware');
  if (path !== (accountScope ? expected.replace(/\/0\/0$/, '') : expected))
    return invalid();
  const networkId = text(a.networkId, 128);
  if (!isPublicAccountNetwork(impl, networkId)) return invalid();
  const networks =
    a.networks === undefined
      ? undefined
      : (() => {
          if (!Array.isArray(a.networks) || a.networks.length > 16)
            return invalid();
          return [...new Set(a.networks.map((id) => text(id, 128)))].toSorted();
        })();
  const createAtNetwork =
    a.createAtNetwork === undefined ? undefined : text(a.createAtNetwork, 128);
  if (
    [...(networks ?? []), ...(createAtNetwork ? [createAtNetwork] : [])].some(
      (id) => !isPublicAccountNetwork(impl, id),
    )
  )
    return invalid();
  const account: ICloudPublicAccountSnapshot['account'] = {
    impl,
    type: chain.type,
    networkId,
    coinType: chain.coinType,
    path,
    pathIndex,
    template,
    idSuffix,
    name: text(a.name, 256, true),
    address: text(a.address, 256, chain.type === 'variant'),
    pub: text(a.pub, 512, true),
    networks,
    createAtNetwork,
  };
  if (chain.type === 'variant' && account.address !== '') return invalid();
  const lightning = impl === 'lightning' || impl === 'tlightning';
  if (a.xpub !== undefined)
    account.xpub = text(
      a.xpub,
      512,
      ['nexa', 'dynex', 'alph', 'scdo'].includes(impl),
    );
  if (a.xpubSegwit !== undefined)
    account.xpubSegwit = text(a.xpubSegwit, 512, true);
  if (a.relPath !== undefined)
    account.relPath = text(a.relPath, 32, impl === 'dynex');
  if (a.addresses !== undefined) {
    account.addresses = {};
    for (const [key, address] of Object.entries(object(a.addresses))) {
      if (chain.type === 'utxo' && !['nexa', 'dynex'].includes(impl)) {
        if (
          !/^[012]\/\d{1,10}$/.test(key) ||
          Number(key.split('/')[1]) >= 2 ** 31 ||
          (key.startsWith('2/') && impl !== 'ada')
        )
          return invalid();
      } else if ((lightning || impl === 'scdo') && key === '0/0') {
        if (address !== account.address) return invalid();
      } else if (!isPublicAccountNetwork(impl, key)) return invalid();
      account.addresses[key] = text(address);
    }
  }
  if (
    chain.type === 'variant' &&
    (!account.addresses ||
      !Object.keys(account.addresses).length ||
      !account.addresses[networkId])
  )
    return invalid();
  if (
    chain.type !== 'utxo' &&
    !lightning &&
    ((a.xpub !== undefined &&
      !(['alph', 'scdo'].includes(impl) && a.xpub === '')) ||
      (a.xpubSegwit !== undefined && a.xpubSegwit !== ''))
  )
    return invalid();
  if (
    impl !== 'alph' &&
    !lightning &&
    chain.type !== 'utxo' &&
    a.relPath !== undefined
  )
    return invalid();
  if (lightning && account.relPath !== undefined && account.relPath !== '0/0')
    return invalid();
  if (
    impl === 'alph' &&
    (!account.relPath ||
      !/^[01]\/\d{1,10}$/.test(account.relPath) ||
      Number(account.relPath.split('/')[1]) >= 2 ** 31)
  )
    return invalid();
  const result: ICloudPublicAccountSnapshot = {
    schema: 'onekey-public-account',
    version: 2,
    capabilities: ['account-copy-v2'],
    wallet: {
      kind: wallet.kind,
      xfp: normalizeFullWalletXfp(text(wallet.xfp, 140)),
      hidden: wallet.hidden,
    },
    account,
  };
  if (
    Buffer.byteLength(stringUtils.stableStringify(result), 'utf8') >
    16 * 1024
  )
    return invalid();
  return result;
}
