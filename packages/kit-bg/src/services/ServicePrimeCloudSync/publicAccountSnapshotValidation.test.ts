import { wallet as neo } from '@cityofzion/neon-core';
import { payments } from 'bitcoinjs-lib';
import bs58 from 'bs58';

import CoreChainHd from '@onekeyhq/core/src/chains/btc/CoreChainHd';
import {
  convertBtcForkXpub,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { conflux } from '@onekeyhq/core/src/chains/cfx/sdkCfx';
import { pubkeyToAddressDetail } from '@onekeyhq/core/src/chains/cosmos/sdkCosmos/address';
import coreChainApi, {
  getCoreChainApiScopeByImpl,
} from '@onekeyhq/core/src/instance/coreChainApi';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  ICloudPublicAccountImpl,
  ICloudPublicAccountSnapshot,
} from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { createVaultInstance } from '../../vaults/factory';
import { cnFastHash, encodeVarInt } from '../../vaults/impls/dnx/utils';
import { publicKeyToAddress } from '../../vaults/impls/scdo/utils';
import {
  getVaultSettings,
  getVaultSettingsNetworkInfo,
} from '../../vaults/settings';

import { normalizePublicAccountSnapshot } from './publicAccountSnapshot';
import { PublicAccountSnapshotUnsupportedError } from './publicAccountSnapshotErrors';
import { PUBLIC_ACCOUNT_CHAIN_POLICIES } from './publicAccountSnapshotV2';
import { validatePublicAccount } from './publicAccountSnapshotValidation';

import type { VaultBase } from '../../vaults/base/VaultBase';

// Use the same installed Algorand SDK's CommonJS build in Jest, whose runtime
// cannot execute the ESM entry selected by the production Vault wrapper.
jest.mock('algosdk/dist/esm/index.js', () =>
  jest.requireActual<typeof import('algosdk')>('algosdk/dist/cjs/index.js'),
);
// Jest uses CSL's Node build for the same versioned, public-only API, as the
// repository's existing Cardano browser-library mapping does for other suites.
jest.mock(
  '@emurgo/cardano-serialization-lib-asmjs/cardano_serialization_lib',
  () =>
    jest.requireActual<
      typeof import('@emurgo/cardano-serialization-lib-nodejs')
    >('@emurgo/cardano-serialization-lib-nodejs'),
);

// Public BIP32 and generator/Ed25519 fixtures; no seed or signing API is used.
const XPUB =
  'xpub6C1HVMz946r433QEjZGpYYWYcspxXXBPys5PBGkmQboRXE6RLfFiStEkKbWKCZaPgDrzZh9nUEunxuiuy6MNdw23du2Ek7GoKYMJVH8eK5E';
const SECP =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const ED = '9cc26ec7b1ca4dbf3c9588534c6e7e2a537fab3f60f1d2d50c0e7a9bce413b73';
const NEO =
  '036b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296';
const ADA_XPUB =
  'b26be5c118159882386e2b301486108a9d92cc7346c419f3f8e0fc74e89b0fe3c3c81ca61635db3464f15301413b92747a37c9c1ddb998f1257496903dc55890';
const ADA_ADDRESS =
  'addr1qyrqyaqmp660u4jrpxv5xytsruvl0t644lwxvyvhsm7k3ye8xynpv3levq92pp7cmu7seltu8qxne2thlvpkqpd2k7mquxwa5w';
const ADA_STAKE = 'stake1uynnzfskglukqz4qslvd70gvl47rsrfu49mlkqmqqk4t0ds3rdgqv';

function cryptoNoteEncode(hex: string): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = Buffer.from(hex, 'hex');
  const widths = [0, 2, 3, 5, 6, 7, 9, 10, 11];
  const encoded: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8) {
    const block = bytes.subarray(offset, offset + 8);
    let value = BigInt(`0x${block.toString('hex')}`);
    let text = '';
    while (value > 0n) {
      text = alphabet[Number(value % 58n)] + text;
      value /= 58n;
    }
    encoded.push(text.padStart(widths[block.length], '1'));
  }
  return encoded.join('');
}

function dynexAddress(): string {
  const body = `${encodeVarInt(185)}${ED}${ED}`;
  return cryptoNoteEncode(body + cnFastHash(body).slice(2, 10));
}

async function fixture(impl: ICloudPublicAccountImpl) {
  const network = getPresetNetworks().find((item) => item.impl === impl);
  if (!network) throw new PublicAccountSnapshotUnsupportedError();
  const settings = await getVaultSettings({ networkId: network.id });
  const deriveInfo = settings.accountDeriveInfo.default;
  const fullPath = accountUtils.buildPathFromTemplate({
    template: deriveInfo.template,
    index: 0,
  });
  const policy = PUBLIC_ACCOUNT_CHAIN_POLICIES[impl];
  const snapshot: ICloudPublicAccountSnapshot = {
    schema: 'onekey-public-account',
    version: 2,
    capabilities: ['account-copy-v2'],
    wallet: {
      kind: policy.hardwareOnly ? 'hardware' : 'hd',
      xfp: `12345678--${XPUB}`,
      hidden: false,
    },
    account: {
      impl,
      networkId: network.id,
      type: policy.type,
      template: deriveInfo.template,
      path:
        policy.type === 'utxo' && impl !== 'dynex'
          ? fullPath.replace(/\/0\/0$/, '')
          : fullPath,
      pathIndex: 0,
      coinType: deriveInfo.coinType,
      idSuffix: deriveInfo.idSuffix,
      name: 'Public test',
      address: '',
      pub: '',
    },
  };
  const networkSettings = await getVaultSettingsNetworkInfo({
    networkId: network.id,
  });
  const networkInfo = {
    networkId: network.id,
    networkImpl: impl,
    networkChainCode: network.code,
    chainId: networkUtils.getNetworkChainId({ networkId: network.id }),
    isTestnet: network.isTestnet,
    ...networkSettings,
  };
  const getAllCustomNetworks = jest.fn(
    async (): Promise<IServerNetwork[]> => [],
  );
  const getAllServerNetworks = jest.fn(async () => ({
    networks: [] as IServerNetwork[],
    lastFetchTime: 1,
  }));
  const forbidden = jest.fn();
  // The real core public-address functions run below. The Vault boundary only
  // normalizes output for this dispatch suite; address-only cases test real SDKs.
  const validateAddress = jest.fn(async (value: string) => ({
    isValid: Boolean(value),
    normalizedAddress: value.toLowerCase(),
  }));
  const vault = {
    validateAddress,
    getCoreApiNetworkInfo: jest.fn(async () => networkInfo),
    backgroundApi: {
      simpleDb: {
        customNetwork: { getAllCustomNetworks },
        serverNetwork: { getAllServerNetworks },
      },
      serviceHardware: { getSDKInstance: forbidden },
      servicePassword: { getCachedPassword: forbidden },
    },
    keyring: { prepareAccounts: forbidden },
  } as unknown as VaultBase;
  const account = snapshot.account;
  const btc = ['btc', 'tbtc', 'ltc', 'doge', 'bch', 'neurai'].includes(impl);
  if (btc || impl === 'lightning' || impl === 'tlightning') {
    const isLightning = impl === 'lightning' || impl === 'tlightning';
    let networkCode = network.code;
    if (isLightning) networkCode = impl === 'tlightning' ? 'tbtc' : 'btc';
    const btcNetwork = getBtcForkNetwork(networkCode);
    const encoding = isLightning
      ? EAddressEncodings.P2WPKH
      : deriveInfo.addressEncoding;
    const xpub = convertBtcForkXpub({
      btcForkNetwork: btcNetwork,
      xpub: XPUB,
      addressEncoding: encoding,
    });
    const api = (() => {
      switch (impl) {
        case 'ltc':
          return coreChainApi.ltc.hd;
        case 'bch':
          return coreChainApi.bch.hd;
        case 'doge':
          return coreChainApi.doge.hd;
        case 'neurai':
          return coreChainApi.neurai.hd;
        default:
          return coreChainApi.btc.hd;
      }
    })();
    const derived = await api.getAddressFromXpub({
      network: btcNetwork,
      xpub,
      relativePaths: ['0/0', '1/2'],
      addressEncoding: encoding,
    });
    Object.assign(account, {
      xpub,
      address: derived.addresses['0/0'],
      relPath: '0/0',
      addresses: isLightning
        ? { '0/0': derived.addresses['0/0'] }
        : derived.addresses,
      pub: isLightning ? xpub : derived.publicKeys['0/0'],
      xpubSegwit: derived.xpubSegwit,
    });
  } else if (impl === 'ada') {
    Object.assign(account, {
      xpub: ADA_XPUB,
      address: ADA_ADDRESS,
      relPath: '0/0',
      addresses: { '0/0': ADA_ADDRESS, '2/0': ADA_STAKE },
    });
  } else if (impl === 'dynex') {
    Object.assign(account, {
      address: dynexAddress(),
      xpub: '',
      relPath: '',
      addresses: {},
    });
  } else if (impl === 'neo') {
    account.pub = NEO;
    account.address = neo.getAddressFromScriptHash(
      neo.getScriptHashFromPublicKey(NEO),
    );
  } else if (impl === 'alph') {
    const { addressFromPublicKey } = await import('@alephium/web3');
    Object.assign(account, {
      pub: SECP,
      address: addressFromPublicKey(SECP),
      relPath: '0/0',
    });
  } else if (impl === 'scdo') {
    Object.assign(account, {
      pub: SECP,
      address: publicKeyToAddress(Buffer.from(SECP, 'hex')),
    });
  } else if (impl === 'cosmos') {
    account.pub = SECP;
    account.addresses = {
      [network.id]: pubkeyToAddressDetail({
        curve: networkSettings.curve,
        publicKey: SECP,
        addressPrefix: networkSettings.addressPrefix,
      }).address,
    };
  } else {
    const publicKey = networkSettings.curve === 'ed25519' ? ED : SECP;
    const derived = await getCoreChainApiScopeByImpl({
      impl,
    }).hd.getAddressFromPublic({
      networkInfo,
      publicKey,
      addressEncoding: deriveInfo.addressEncoding,
    });
    Object.assign(account, {
      pub: derived.publicKey,
      address: derived.address,
      addresses: derived.addresses,
    });
  }
  return {
    snapshot,
    vault,
    deriveInfo,
    forbidden,
    validateAddress,
    network,
    getAllCustomNetworks,
    getAllServerNetworks,
    isCurrent: () => true,
  };
}

describe('public account offline validation', () => {
  it.each(
    Object.keys(PUBLIC_ACCOUNT_CHAIN_POLICIES) as ICloudPublicAccountImpl[],
  )(
    'validates real public fields for %s without private or device APIs',
    async (impl) => {
      const params = await fixture(impl);
      params.snapshot = normalizePublicAccountSnapshot(params.snapshot);
      await expect(validatePublicAccount(params)).resolves.toBe(true);
      expect(params.forbidden).not.toHaveBeenCalled();
      if (params.snapshot.account.type === 'variant') {
        const id = Object.keys(params.snapshot.account.addresses ?? {})[0];
        params.snapshot.account.addresses = { [id]: 'invalid-public-address' };
      } else params.snapshot.account.address = 'invalid-public-address';
      await expect(validatePublicAccount(params)).resolves.toBe(false);
    },
  );

  it('keeps the existing NEAR public vector and rejects another implicit account', async () => {
    const params = await fixture('near');
    params.snapshot.account.pub = `ed25519:${bs58.encode(Buffer.from(ED, 'hex'))}`;
    params.snapshot.account.address = ED;
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    params.snapshot.account.address = '11'.repeat(32);
    await expect(validatePublicAccount(params)).resolves.toBe(false);
  });

  it('handles persisted Solana base58 public keys and refuses missing software material', async () => {
    const params = await fixture('sol');
    expect(params.snapshot.account.pub).toBe(
      bs58.encode(Buffer.from(ED, 'hex')),
    );
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    params.snapshot.account.pub = '';
    await expect(validatePublicAccount(params)).rejects.toBeInstanceOf(
      PublicAccountSnapshotUnsupportedError,
    );
  });

  it('checks the complete ADA base/stake public vector and each child address', async () => {
    const params = await fixture('ada');
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    params.snapshot.account.addresses = {
      '0/0': ADA_ADDRESS,
      '2/0': ADA_ADDRESS,
    };
    await expect(validatePublicAccount(params)).resolves.toBe(false);
    params.snapshot.account.xpub = '';
    await expect(validatePublicAccount(params)).rejects.toBeInstanceOf(
      PublicAccountSnapshotUnsupportedError,
    );
  });

  it('rejects a DNX checksum mutation without invoking its server validator', async () => {
    const params = await fixture('dynex');
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    expect(params.validateAddress).not.toHaveBeenCalled();
    const address = params.snapshot.account.address;
    params.snapshot.account.address =
      address.slice(0, -1) + (address.endsWith('1') ? '2' : '1');
    await expect(validatePublicAccount(params)).resolves.toBe(false);
    expect(params.validateAddress).not.toHaveBeenCalled();
  });

  it.each([
    'evm',
    'sol',
    'tron',
    'algo',
    'nervos',
    'stellar',
    'scdo',
    'kaspa',
  ] as const)(
    'validates historical %s hardware address-only data with existing offline validators',
    async (impl) => {
      const params = await fixture(impl);
      params.snapshot.wallet.kind = 'hardware';
      params.snapshot.account.pub = '';
      const actualVault = await createVaultInstance({
        accountId: '',
        networkId: params.network.id,
        isChainOnly: true,
        backgroundApi: params.vault.backgroundApi,
      });
      jest.spyOn(actualVault, 'getNetwork').mockResolvedValue(params.network);
      await expect(
        validatePublicAccount({ ...params, vault: actualVault }),
      ).resolves.toBe(true);
      if (params.snapshot.account.type === 'variant') {
        params.snapshot.account.addresses = {
          [params.network.id]: 'invalid-public-address',
        };
      } else params.snapshot.account.address = 'invalid-public-address';
      await expect(
        validatePublicAccount({ ...params, vault: actualVault }),
      ).resolves.toBe(false);
      expect(params.forbidden).not.toHaveBeenCalled();
    },
  );

  it('validates historical Filecoin hardware records directly without loading its signing SDK', async () => {
    const params = await fixture('fil');
    params.snapshot.wallet.kind = 'hardware';
    params.snapshot.account.pub = '';
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    params.snapshot.account.addresses = {
      [params.network.id]: 'invalid-public-address',
    };
    await expect(validatePublicAccount(params)).resolves.toBe(false);
    expect(params.forbidden).not.toHaveBeenCalled();
    expect(params.validateAddress).not.toHaveBeenCalled();
  });

  it('validates actual historical Conflux hardware shape, checksum and network, without extending the software exception', async () => {
    const params = await fixture('cfx');
    params.snapshot.wallet.kind = 'hardware';
    params.snapshot.account.pub = '';
    params.snapshot = normalizePublicAccountSnapshot(params.snapshot);
    const original =
      params.snapshot.account.addresses?.[params.network.id] ?? '';
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    params.snapshot.account.addresses = {
      [params.network.id]:
        original.slice(0, -1) + (original.endsWith('a') ? 'b' : 'a'),
    };
    await expect(validatePublicAccount(params)).resolves.toBe(false);
    const decoded = conflux.address.decodeCfxAddress(original);
    params.snapshot.account.addresses = {
      [params.network.id]: conflux.address.encodeCfxAddress(
        decoded.hexAddress,
        1,
      ),
    };
    await expect(validatePublicAccount(params)).resolves.toBe(false);
    params.snapshot.account.addresses = { [params.network.id]: original };
    params.snapshot.wallet.kind = 'hd';
    await expect(validatePublicAccount(params)).rejects.toBeInstanceOf(
      PublicAccountSnapshotUnsupportedError,
    );
    expect(params.forbidden).not.toHaveBeenCalled();
    expect(params.validateAddress).not.toHaveBeenCalled();
  });

  it('checks every historical Conflux network and requires their decoded public addresses to agree', async () => {
    const params = await fixture('cfx');
    params.snapshot.wallet.kind = 'hardware';
    params.snapshot.account.pub = '';
    const original =
      params.snapshot.account.addresses?.[params.network.id] ?? '';
    const decoded = conflux.address.decodeCfxAddress(original);
    const custom = {
      ...params.network,
      id: 'cfx--1',
      chainId: '1',
      isTestnet: true,
    };
    params.getAllCustomNetworks.mockResolvedValue([custom]);
    params.snapshot.account.addresses = {
      [params.network.id]: original,
      [custom.id]: conflux.address.encodeCfxAddress(decoded.hexAddress, 1),
    };
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    params.snapshot.account.addresses[custom.id] = original;
    await expect(validatePublicAccount(params)).resolves.toBe(false);
    params.snapshot.account.addresses[custom.id] =
      conflux.address.encodeCfxAddress(Buffer.from('11'.repeat(20), 'hex'), 1);
    await expect(validatePublicAccount(params)).resolves.toBe(false);
    expect(params.forbidden).not.toHaveBeenCalled();
  });

  it('validates 64 BTC children through at most four paths per public SDK call and yields between batches', async () => {
    const params = await fixture('btc');
    const addresses = Object.fromEntries(
      Array.from({ length: 64 }, (_, index) => [
        `0/${index}`,
        `public-batch-fixture-${index}`,
      ]),
    );
    Object.assign(params.snapshot.account, {
      addresses,
      address: addresses['0/0'],
      pub: '',
      xpubSegwit: undefined,
    });
    // Only the batching boundary is doubled; the chain matrix above exercises
    // the real public cryptographic implementations and snapshot normalizer.
    const publicApi = jest
      .spyOn(CoreChainHd.prototype, 'getAddressFromXpub')
      .mockImplementation(async ({ relativePaths }) => ({
        addresses: Object.fromEntries(
          relativePaths.map((path) => [path, addresses[path]]),
        ),
        publicKeys: {},
        xpubSegwit: params.snapshot.account.xpub ?? '',
      }));
    const yieldToRuntime = jest.spyOn(timerUtils, 'wait');
    try {
      await expect(validatePublicAccount(params)).resolves.toBe(true);
      expect(publicApi).toHaveBeenCalledTimes(16);
      expect(
        publicApi.mock.calls.every(
          ([input]) => input.relativePaths.length <= 4,
        ),
      ).toBe(true);
      expect(
        publicApi.mock.calls.flatMap(([input]) => input.relativePaths),
      ).toEqual(Object.keys(addresses));
      expect(yieldToRuntime).toHaveBeenCalledTimes(15);
      expect(
        yieldToRuntime.mock.calls.every(([milliseconds]) => milliseconds === 0),
      ).toBe(true);
    } finally {
      publicApi.mockRestore();
      yieldToRuntime.mockRestore();
    }
  });

  it('lets a queued cancellation run after the first BTC public batch and starts no later batch', async () => {
    const params = await fixture('btc');
    const addresses = Object.fromEntries(
      Array.from({ length: 8 }, (_, index) => [
        `0/${index}`,
        `public-cancel-fixture-${index}`,
      ]),
    );
    Object.assign(params.snapshot.account, {
      addresses,
      address: addresses['0/0'],
      pub: '',
      xpubSegwit: undefined,
    });
    let current = true;
    const publicApi = jest
      .spyOn(CoreChainHd.prototype, 'getAddressFromXpub')
      .mockImplementation(async ({ relativePaths }) => {
        setTimeout(() => {
          current = false;
        }, 0);
        return {
          addresses: Object.fromEntries(
            relativePaths.map((path) => [path, addresses[path]]),
          ),
          publicKeys: {},
          xpubSegwit: params.snapshot.account.xpub ?? '',
        };
      });
    const yieldToRuntime = jest.spyOn(timerUtils, 'wait');
    try {
      await expect(
        validatePublicAccount({ ...params, isCurrent: () => current }),
      ).resolves.toBe(false);
      expect(current).toBe(false);
      expect(publicApi).toHaveBeenCalledTimes(1);
      expect(yieldToRuntime).toHaveBeenCalledTimes(1);
    } finally {
      publicApi.mockRestore();
      yieldToRuntime.mockRestore();
    }
  });

  it('binds explicit BTC-fork script version bytes to the selected encoding', async () => {
    const params = await fixture('ltc');
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    await expect(
      validatePublicAccount({
        ...params,
        deriveInfo: {
          ...params.deriveInfo,
          addressEncoding: EAddressEncodings.P2WPKH,
        },
      }),
    ).resolves.toBe(false);
  });

  it('keeps Kaspa Official and OneKey encoding separate', async () => {
    const params = await fixture('kaspa');
    const settings = await getVaultSettings({ networkId: params.network.id });
    const official = Object.values(settings.accountDeriveInfo).find(
      (item) => item.addressEncoding === EAddressEncodings.KASPA_ORG,
    );
    if (!official) throw new PublicAccountSnapshotUnsupportedError();
    params.snapshot.account.idSuffix = official.idSuffix;
    await expect(
      validatePublicAccount({ ...params, deriveInfo: official }),
    ).resolves.toBe(false);
    const info = await getVaultSettingsNetworkInfo({
      networkId: params.network.id,
    });
    const derived = await coreChainApi.kaspa.hd.getAddressFromPublic({
      networkInfo: {
        networkId: params.network.id,
        networkImpl: 'kaspa',
        networkChainCode: params.network.code,
        chainId: params.network.chainId,
        ...info,
      },
      publicKey: SECP,
      addressEncoding: official.addressEncoding,
    });
    params.snapshot.account.address = derived.address;
    await expect(
      validatePublicAccount({ ...params, deriveInfo: official }),
    ).resolves.toBe(true);
  });

  it.each(['lightning', 'tlightning'] as const)(
    'validates historical %s software compressed leaf keys without account xpub or auth',
    async (impl) => {
      const params = await fixture(impl);
      const network = getBtcForkNetwork(impl === 'tlightning' ? 'tbtc' : 'btc');
      params.snapshot.account.pub = SECP;
      params.snapshot.account.xpub = undefined;
      params.snapshot.account.xpubSegwit = undefined;
      params.snapshot.account.address =
        payments.p2wpkh({ pubkey: Buffer.from(SECP, 'hex'), network })
          .address ?? '';
      params.snapshot.account.addresses = {
        '0/0': params.snapshot.account.address,
      };
      await expect(validatePublicAccount(params)).resolves.toBe(true);
      const nativeSegwitAddress = params.snapshot.account.address;
      params.snapshot.account.address =
        payments.p2pkh({ pubkey: Buffer.from(SECP, 'hex'), network }).address ??
        '';
      await expect(validatePublicAccount(params)).resolves.toBe(false);
      params.snapshot.account.address = nativeSegwitAddress;
      params.snapshot.account.path = params.snapshot.account.path.replace(
        /\/0\/0$/,
        '',
      );
      await expect(validatePublicAccount(params)).resolves.toBe(false);
      expect(params.forbidden).not.toHaveBeenCalled();
    },
  );

  it('checks every variant network and does not trust copied prefixes', async () => {
    const params = await fixture('cosmos');
    const other = getPresetNetworks().find(
      (item) => item.impl === 'cosmos' && item.id !== params.network.id,
    );
    if (!other) throw new PublicAccountSnapshotUnsupportedError();
    const info = await getVaultSettingsNetworkInfo({ networkId: other.id });
    params.snapshot.account.addresses = {
      ...params.snapshot.account.addresses,
      [other.id]: pubkeyToAddressDetail({
        curve: info.curve,
        publicKey: SECP,
        addressPrefix: info.addressPrefix,
      }).address,
    };
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    params.snapshot.account.addresses[other.id] = Object.values(
      params.snapshot.account.addresses,
    )[0];
    await expect(validatePublicAccount(params)).resolves.toBe(false);
  });

  it('reads a preconfigured custom network locally and leaves missing definitions pending', async () => {
    const params = await fixture('dot');
    const custom = {
      ...params.network,
      id: 'dot--local-public-test',
      chainId: 'local-public-test',
    };
    params.getAllCustomNetworks.mockResolvedValue([custom]);
    const settings = await getVaultSettingsNetworkInfo({
      networkId: custom.id,
    });
    const derived = await coreChainApi.dot.hd.getAddressFromPublic({
      networkInfo: {
        networkId: custom.id,
        networkImpl: 'dot',
        networkChainCode: custom.code,
        chainId: custom.chainId,
        ...settings,
      },
      publicKey: ED,
    });
    const value = derived.addresses?.[custom.id] ?? '';
    params.snapshot.account.networkId = custom.id;
    params.snapshot.account.addresses = { [custom.id]: value };
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    expect(params.getAllCustomNetworks).toHaveBeenCalledTimes(1);
    params.getAllCustomNetworks.mockResolvedValue([]);
    await expect(validatePublicAccount(params)).rejects.toBeInstanceOf(
      PublicAccountSnapshotUnsupportedError,
    );
  });

  it('validates each configured NEXA network address from the same public base key', async () => {
    const params = await fixture('nexa');
    const custom = {
      ...params.network,
      id: 'nexa--1',
      chainId: '1',
      isTestnet: true,
    };
    params.getAllCustomNetworks.mockResolvedValue([custom]);
    const info = await getVaultSettingsNetworkInfo({ networkId: custom.id });
    const derived = await coreChainApi.nexa.hd.getAddressFromPublic({
      networkInfo: {
        networkId: custom.id,
        networkImpl: 'nexa',
        networkChainCode: custom.code,
        chainId: custom.chainId,
        ...info,
      },
      publicKey: params.snapshot.account.pub,
    });
    params.snapshot.account.addresses = {
      ...params.snapshot.account.addresses,
      ...derived.addresses,
    };
    await expect(validatePublicAccount(params)).resolves.toBe(true);
    params.snapshot.account.addresses[custom.id] = 'invalid-public-address';
    await expect(validatePublicAccount(params)).resolves.toBe(false);
  });

  it('keeps unavailable receiver network storage pending instead of rejecting a valid snapshot', async () => {
    const params = await fixture('dot');
    params.snapshot.account.networkId = 'dot--locally-unavailable';
    params.snapshot.account.addresses = {
      [params.snapshot.account.networkId]: Object.values(
        params.snapshot.account.addresses ?? {},
      )[0],
    };
    params.getAllCustomNetworks.mockRejectedValue(
      new PublicAccountSnapshotUnsupportedError(),
    );
    await expect(validatePublicAccount(params)).rejects.toBeInstanceOf(
      PublicAccountSnapshotUnsupportedError,
    );
  });

  it.each(['sui', 'neo', 'alph', 'nostr'] as const)(
    'keeps %s pending when required public material is missing',
    async (impl) => {
      const params = await fixture(impl);
      params.snapshot.account.pub = '';
      await expect(validatePublicAccount(params)).rejects.toBeInstanceOf(
        PublicAccountSnapshotUnsupportedError,
      );
    },
  );

  it('rejects a mismatched derive context and a cancelled operation', async () => {
    const params = await fixture('evm');
    await expect(
      validatePublicAccount({
        ...params,
        deriveInfo: { ...params.deriveInfo, coinType: '0' },
      }),
    ).resolves.toBe(false);
    await expect(
      validatePublicAccount({ ...params, isCurrent: () => false }),
    ).resolves.toBe(false);
    expect(params.validateAddress).not.toHaveBeenCalled();
  });
});
