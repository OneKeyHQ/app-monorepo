import { ed25519 } from '@noble/curves/ed25519';
import { p256 } from '@noble/curves/p256';
import { secp256k1 } from '@noble/curves/secp256k1';
import bs58 from 'bs58';
import bs58check from 'bs58check';

import {
  getBip32FromBase58,
  getBtcForkNetwork,
  getBtcXpubSupportedAddressEncodings,
  pubkeyToPayment,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi, {
  getCoreChainApiScopeByImpl,
} from '@onekeyhq/core/src/instance/coreChainApi';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import type { ICoreApiNetworkInfo } from '@onekeyhq/core/src/types';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ICloudPublicAccountSnapshot } from '@onekeyhq/shared/types/prime/publicAccountSnapshot';

import { getVaultSettingsNetworkInfo } from '../../vaults/settings';

import { getPublicAccountSnapshotTaprootDescriptor } from './publicAccountSnapshot';
import { PublicAccountSnapshotUnsupportedError } from './publicAccountSnapshotErrors';

import type { VaultBase } from '../../vaults/base/VaultBase';
import type { IAccountDeriveInfo } from '../../vaults/types';

type IValidationParams = {
  snapshot: ICloudPublicAccountSnapshot;
  vault: VaultBase;
  deriveInfo: IAccountDeriveInfo;
  isCurrent: () => boolean;
};

const BTC_PUBLIC_PATH_BATCH_SIZE = 4;

// These existing hardware keyrings persist addresses without public keys.
// Their provenance remains the authenticated snapshot and existing local wallet
// binding; address validation cannot prove ancestry from that wallet's seed.
const HISTORICAL_ADDRESS_ONLY_HARDWARE = new Set([
  'evm',
  'sol',
  'tron',
  'algo',
  'nervos',
  'stellar',
  'fil',
  'scdo',
  'kaspa',
]);

function validPublicKey(
  publicKey: string,
  curve: ICoreApiNetworkInfo['curve'],
): boolean {
  if (!/^[0-9a-fA-F]+$/.test(publicKey)) return false;
  try {
    if (curve === 'ed25519') {
      if (publicKey.length !== 64) return false;
      ed25519.ExtendedPoint.fromHex(publicKey).assertValidity();
    } else {
      if (!/^(02|03)[0-9a-fA-F]{64}$|^04[0-9a-fA-F]{128}$/.test(publicKey))
        return false;
      const api = curve === 'nistp256' ? p256 : secp256k1;
      api.ProjectivePoint.fromHex(publicKey).assertValidity();
    }
    return true;
  } catch {
    return false;
  }
}

async function publicNetworkInfo(
  networkId: string,
  vault: VaultBase,
): Promise<ICoreApiNetworkInfo> {
  let network = getPresetNetworks().find((item) => item.id === networkId);
  const networkImpl = networkUtils.getNetworkImpl({ networkId });
  if (!network) {
    // Read the receiver's definitions directly. ServiceNetwork.getNetwork can
    // start a background server refresh even when its caller only needs metadata.
    try {
      const [custom, cached] = await Promise.all([
        vault.backgroundApi.simpleDb.customNetwork.getAllCustomNetworks(),
        vault.backgroundApi.simpleDb.serverNetwork.getAllServerNetworks(),
      ]);
      network =
        custom.find((item) => item.id === networkId) ??
        cached.networks?.find((item) => item.id === networkId);
    } catch {
      throw new PublicAccountSnapshotUnsupportedError();
    }
  }
  if (!network || network.impl !== networkImpl) {
    throw new PublicAccountSnapshotUnsupportedError();
  }
  const settings = await getVaultSettingsNetworkInfo({ networkId });
  return {
    networkId,
    networkImpl,
    networkChainCode: network?.code ?? 'evm',
    chainId: networkUtils.getNetworkChainId({ networkId }),
    isTestnet: network?.isTestnet ?? false,
    addressPrefix: settings.addressPrefix,
    curve: settings.curve,
  };
}

async function validateBtcAccount(params: IValidationParams): Promise<boolean> {
  const { snapshot, vault, deriveInfo, isCurrent } = params;
  const { account } = snapshot;
  const lightning = ['lightning', 'tlightning'].includes(account.impl);
  const leafPublicKey = /^(02|03)[0-9a-fA-F]{64}$/.test(account.pub);
  const xpub = account.xpub || (lightning && !leafPublicKey ? account.pub : '');
  const relPath = account.relPath || (lightning ? '0/0' : '');
  const networkInfo =
    snapshot.version === 1
      ? await vault.getCoreApiNetworkInfo()
      : await publicNetworkInfo(account.networkId, vault);
  if (!isCurrent()) return false;
  let networkCode = networkInfo.networkChainCode;
  if (lightning) networkCode = account.impl === 'tlightning' ? 'tbtc' : 'btc';
  const network = getBtcForkNetwork(networkCode);
  if (lightning && !xpub && leafPublicKey) {
    // Some software records retain only the native SegWit leaf key. It can
    // validate that leaf's address without inventing an account xpub or auth.
    if (snapshot.wallet.kind !== 'hd')
      throw new PublicAccountSnapshotUnsupportedError();
    const expectedPath = accountUtils.buildPathFromTemplate({
      template: deriveInfo.template,
      index: account.pathIndex,
    });
    if (
      account.path !== expectedPath ||
      relPath !== '0/0' ||
      account.xpubSegwit ||
      !validPublicKey(account.pub, 'secp256k1')
    )
      return false;
    const payment = pubkeyToPayment({
      pubkey: Buffer.from(account.pub, 'hex'),
      encoding: EAddressEncodings.P2WPKH,
      network,
    });
    return (
      isCurrent() &&
      payment.address === account.address &&
      Object.entries(account.addresses ?? {}).every(
        ([path, address]) => path === '0/0' && address === payment.address,
      )
    );
  }
  if (!xpub || !relPath || (!lightning && !account.addresses)) {
    throw new PublicAccountSnapshotUnsupportedError();
  }
  const node = getBip32FromBase58({ network, key: xpub });
  // An account xpub proves consistency of its public children, not hardened
  // ancestry from the wallet fingerprint or any unrelated public branch.
  if (
    !node.isNeutered() ||
    node.depth !== 3 ||
    node.index !== 0x80_00_00_00 + account.pathIndex
  )
    return false;
  const encoding = lightning
    ? EAddressEncodings.P2WPKH
    : deriveInfo.addressEncoding;
  const version = Buffer.from(bs58check.decode(xpub)).readUInt32BE(0);
  const supported = getBtcXpubSupportedAddressEncodings({
    network,
    xpub,
  }).supportEncodings;
  // The base version is an existing firmware fallback for all script types.
  // Explicit SLIP-132 script versions must agree with the selected template.
  if (
    version !== network.bip32.public &&
    (!encoding || !supported?.includes(encoding))
  )
    return false;
  const relativePaths = [
    ...new Set([relPath, ...Object.keys(account.addresses ?? {})]),
  ];
  if (lightning) {
    const addresses: Record<string, string> = {};
    for (
      let offset = 0;
      offset < relativePaths.length;
      offset += BTC_PUBLIC_PATH_BATCH_SIZE
    ) {
      if (!isCurrent()) return false;
      const chunk = await coreChainApi.lightning.hd.getAddressFromXpub({
        network,
        xpub,
        relativePaths: relativePaths.slice(
          offset,
          offset + BTC_PUBLIC_PATH_BATCH_SIZE,
        ),
        addressEncoding: EAddressEncodings.P2WPKH,
      });
      if (!isCurrent()) return false;
      Object.assign(addresses, chunk);
      if (offset + BTC_PUBLIC_PATH_BATCH_SIZE < relativePaths.length) {
        await timerUtils.wait(0);
        if (!isCurrent()) return false;
      }
    }
    return (
      isCurrent() &&
      account.pub === xpub &&
      addresses[relPath] === account.address &&
      Object.entries(account.addresses ?? {}).every(
        ([path, address]) => addresses[path] === address,
      ) &&
      (!account.xpubSegwit || account.xpubSegwit === xpub)
    );
  }
  const api = {
    btc: coreChainApi.btc.hd,
    tbtc: coreChainApi.btc.hd,
    ltc: coreChainApi.ltc.hd,
    doge: coreChainApi.doge.hd,
    bch: coreChainApi.bch.hd,
    neurai: coreChainApi.neurai.hd,
  };
  const impl = account.impl;
  if (
    impl !== 'btc' &&
    impl !== 'tbtc' &&
    impl !== 'ltc' &&
    impl !== 'doge' &&
    impl !== 'bch' &&
    impl !== 'neurai'
  )
    return false;
  const derived: {
    addresses: Record<string, string>;
    publicKeys: Record<string, string>;
    xpubSegwit?: string;
  } = { addresses: {}, publicKeys: {} };
  for (
    let offset = 0;
    offset < relativePaths.length;
    offset += BTC_PUBLIC_PATH_BATCH_SIZE
  ) {
    if (!isCurrent()) return false;
    const chunk = await api[impl].getAddressFromXpub({
      network,
      xpub,
      relativePaths: relativePaths.slice(
        offset,
        offset + BTC_PUBLIC_PATH_BATCH_SIZE,
      ),
      addressEncoding: deriveInfo.addressEncoding,
    });
    if (
      !isCurrent() ||
      (derived.xpubSegwit !== undefined &&
        derived.xpubSegwit !== chunk.xpubSegwit)
    )
      return false;
    Object.assign(derived.addresses, chunk.addresses);
    Object.assign(derived.publicKeys, chunk.publicKeys);
    derived.xpubSegwit = chunk.xpubSegwit;
    if (offset + BTC_PUBLIC_PATH_BATCH_SIZE < relativePaths.length) {
      await timerUtils.wait(0);
      if (!isCurrent()) return false;
    }
  }
  return (
    isCurrent() &&
    derived.addresses[relPath] === account.address &&
    Object.entries(account.addresses ?? {}).every(
      ([path, value]) => derived.addresses[path] === value,
    ) &&
    (!account.pub ||
      derived.publicKeys[relPath]?.toLowerCase() ===
        account.pub.toLowerCase()) &&
    (!account.xpubSegwit ||
      account.xpubSegwit === derived.xpubSegwit ||
      (derived.xpubSegwit === `tr(${xpub})` &&
        account.xpubSegwit ===
          getPublicAccountSnapshotTaprootDescriptor({
            walletXfp: snapshot.wallet.xfp,
            path: account.path,
            xpub,
          })))
  );
}

async function validateAdaAccount(params: IValidationParams): Promise<boolean> {
  const { account } = params.snapshot;
  if (!account.xpub) throw new PublicAccountSnapshotUnsupportedError();
  if (!/^[0-9a-fA-F]{128}$/.test(account.xpub)) return false;
  const { Bip32PublicKey } =
    await import('@emurgo/cardano-serialization-lib-asmjs/cardano_serialization_lib');
  const { baseAddressFromXpub, stakingAddressFromXpub } =
    await import('@onekeyhq/core/src/chains/ada/sdkAda/addresses');
  const network = await publicNetworkInfo(account.networkId, params.vault);
  if (!params.isCurrent()) return false;
  const networkId = network.isTestnet ? 0 : 1;
  const root = Buffer.from(account.xpub, 'hex');
  if (!validPublicKey(root.subarray(0, 32).toString('hex'), 'ed25519'))
    return false;
  const accountKey = Bip32PublicKey.from_bytes(root);
  try {
    const child = (role: number, index: number): Buffer => {
      const branch = accountKey.derive(role);
      try {
        const leaf = branch.derive(index);
        try {
          return Buffer.from(leaf.as_bytes());
        } finally {
          leaf.free();
        }
      } finally {
        branch.free();
      }
    };
    const stake = child(2, 0);
    const expected = (path: string): string | undefined => {
      const [role, index] = path.split('/').map(Number);
      if (
        !/^[012]\/\d+$/.test(path) ||
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index >= 2 ** 31
      )
        return undefined;
      if (role === 2)
        return index === 0
          ? stakingAddressFromXpub(stake, networkId)
          : undefined;
      return baseAddressFromXpub(child(role, index), stake, networkId);
    };
    const relPath = account.relPath;
    if (!relPath || !account.addresses || expected(relPath) !== account.address)
      return false;
    return (
      params.isCurrent() &&
      Object.entries(account.addresses).every(
        ([path, address]) => expected(path) === address,
      ) &&
      !account.pub
    );
  } finally {
    accountKey.free();
  }
}

async function validateDynexAccount(
  params: IValidationParams,
): Promise<boolean> {
  const { account, wallet } = params.snapshot;
  if (wallet.kind !== 'hardware') return false;
  const network = await publicNetworkInfo(account.networkId, params.vault);
  if (!params.isCurrent()) return false;
  if (network.isTestnet) throw new PublicAccountSnapshotUnsupportedError();
  const { cnBase58Decode, cnFastHash, encodeVarInt } =
    await import('../../vaults/impls/dnx/utils');
  if (!params.isCurrent()) return false;
  const decoded = cnBase58Decode(account.address);
  // Unlike decodeAddress(), check the complete payload and checksum before
  // accepting the public spend/view keys embedded in a CryptoNote address.
  const standard = encodeVarInt(185);
  const integrated = encodeVarInt(29);
  const subaddress = encodeVarInt(52);
  const prefix = [standard, integrated, subaddress].find((value) =>
    decoded.startsWith(value),
  );
  if (
    !prefix ||
    decoded.length !==
      prefix.length + 128 + (prefix === integrated ? 16 : 0) + 8
  )
    return false;
  const body = decoded.slice(0, -8);
  const checksum = hexUtils.stripHexPrefix(cnFastHash(body)).slice(0, 8);
  if (checksum !== decoded.slice(-8)) return false;
  const spend = decoded.slice(prefix.length, prefix.length + 64);
  const view = decoded.slice(prefix.length + 64, prefix.length + 128);
  if (!validPublicKey(spend, 'ed25519') || !validPublicKey(view, 'ed25519'))
    return false;
  if (
    account.xpub ||
    account.xpubSegwit ||
    account.relPath ||
    Object.keys(account.addresses ?? {}).length
  )
    return false;
  // Current hardware records omit both keys. A supplied key must at least
  // agree with the embedded public spend key; it is never treated as a seed.
  return !account.pub || account.pub.toLowerCase() === spend;
}

async function validateVariantAccount(
  params: IValidationParams,
): Promise<boolean> {
  const { snapshot, isCurrent } = params;
  const { account } = snapshot;
  if (account.address || !account.addresses?.[account.networkId]) return false;
  if (
    !account.pub &&
    (snapshot.wallet.kind !== 'hardware' ||
      !['fil', 'cfx'].includes(account.impl))
  ) {
    throw new PublicAccountSnapshotUnsupportedError();
  }
  let addressOnlyCfxHex: string | undefined;
  for (const [networkId, address] of Object.entries(account.addresses)) {
    const networkInfo = await publicNetworkInfo(networkId, params.vault);
    if (!isCurrent()) return false;
    if (networkInfo.networkImpl !== account.impl) return false;
    if (!account.pub) {
      // These hardware keyrings historically store only network addresses.
      // Check their real encoding/network while retaining the authenticated
      // Cloud/local-wallet trust boundary, without claiming seed ancestry.
      if (account.impl === 'cfx') {
        const { conflux } =
          await import('@onekeyhq/core/src/chains/cfx/sdkCfx');
        const decoded = conflux.address.decodeCfxAddress(address);
        const hexAddress = decoded.hexAddress.toString('hex');
        if (
          !isCurrent() ||
          decoded.netId !== Number(networkInfo.chainId) ||
          decoded.type !== 'user' ||
          (addressOnlyCfxHex !== undefined && addressOnlyCfxHex !== hexAddress)
        )
          return false;
        addressOnlyCfxHex = hexAddress;
      } else {
        const { validateAddressString } =
          await import('@glif/filecoin-address');
        if (
          !isCurrent() ||
          !validateAddressString(address) ||
          !address.startsWith(networkInfo.isTestnet ? 't1' : 'f1')
        )
          return false;
      }
    } else {
      if (
        !validPublicKey(hexUtils.stripHexPrefix(account.pub), networkInfo.curve)
      )
        return false;
      let expected: string | undefined;
      if (account.impl === 'cosmos') {
        const { pubkeyToAddressDetail } =
          await import('@onekeyhq/core/src/chains/cosmos/sdkCosmos/address');
        expected = pubkeyToAddressDetail({
          curve: networkInfo.curve ?? 'secp256k1',
          publicKey: account.pub,
          addressPrefix: networkInfo.addressPrefix,
        }).address;
      } else {
        const derived = await getCoreChainApiScopeByImpl({
          impl: account.impl,
        }).hd.getAddressFromPublic({ networkInfo, publicKey: account.pub });
        expected = derived.addresses?.[networkId];
      }
      if (
        !isCurrent() ||
        !expected ||
        (account.impl === 'cfx'
          ? expected.toLowerCase() !== address.toLowerCase()
          : expected !== address)
      )
        return false;
    }
  }
  return isCurrent();
}

async function validatePublicAccountData(
  params: IValidationParams,
): Promise<boolean> {
  const { snapshot, vault, deriveInfo, isCurrent } = params;
  const { account } = snapshot;
  if (!isCurrent()) return false;
  if (
    deriveInfo.template !== account.template ||
    deriveInfo.coinType !== account.coinType ||
    (deriveInfo.idSuffix ?? '') !== (account.idSuffix ?? '')
  )
    return false;
  if (
    [
      'btc',
      'tbtc',
      'ltc',
      'doge',
      'bch',
      'neurai',
      'lightning',
      'tlightning',
    ].includes(account.impl)
  )
    return validateBtcAccount(params);
  if (account.impl === 'ada') return validateAdaAccount(params);
  if (account.impl === 'dynex') return validateDynexAccount(params);
  if (account.type === 'variant') return validateVariantAccount(params);

  const networkInfo =
    snapshot.version === 1
      ? await vault.getCoreApiNetworkInfo()
      : await publicNetworkInfo(account.networkId, vault);
  if (!isCurrent()) return false;

  const address =
    account.impl === 'nexa'
      ? undefined
      : await vault.validateAddress(account.address);
  // NEXA persists the raw public key as its base address, not its display address.
  if (!isCurrent() || (account.impl !== 'nexa' && !address?.isValid))
    return false;
  if (!account.pub) {
    if (
      snapshot.wallet.kind !== 'hardware' ||
      !HISTORICAL_ADDRESS_ONLY_HARDWARE.has(account.impl)
    )
      throw new PublicAccountSnapshotUnsupportedError();
    return (
      !account.xpub &&
      !account.xpubSegwit &&
      Object.entries(account.addresses ?? {}).every(
        ([path, value]) =>
          account.impl === 'scdo' &&
          path === '0/0' &&
          value === account.address,
      )
    );
  }
  let publicKey = hexUtils.stripHexPrefix(account.pub);
  if (account.impl === 'sol' && !/^[0-9a-fA-F]{64}$/.test(publicKey)) {
    const decoded = bs58.decode(account.pub);
    if (decoded.length !== 32) return false;
    publicKey = Buffer.from(decoded).toString('hex');
  }
  if (account.impl === 'near' && account.pub.startsWith('ed25519:')) {
    const decoded = bs58.decode(account.pub.slice('ed25519:'.length));
    if (decoded.length !== 32) return false;
    publicKey = Buffer.from(decoded).toString('hex');
  }
  // Nostr's existing core API expects a SEC1 key and strips its first byte,
  // whereas persisted accounts contain the 32-byte x-only public key.
  if (account.impl === 'nostr' && /^[0-9a-fA-F]{64}$/.test(publicKey))
    publicKey = `02${publicKey}`;
  const curve = account.impl === 'neo' ? 'nistp256' : networkInfo.curve;
  if (snapshot.version === 2 && !validPublicKey(publicKey, curve)) return false;
  let derivedAddress: string;
  let derivedAddresses: Record<string, string> | undefined;
  if (account.impl === 'alph') {
    const { addressFromPublicKey } = await import('@alephium/web3');
    derivedAddress = addressFromPublicKey(publicKey);
  } else if (account.impl === 'neo') {
    const { wallet: neo } = await import('@cityofzion/neon-core');
    if (!neo.isPublicKey(publicKey)) return false;
    const compressed =
      publicKey.length === 130 ? neo.getPublicKeyEncoded(publicKey) : publicKey;
    derivedAddress = neo.getAddressFromScriptHash(
      neo.getScriptHashFromPublicKey(compressed),
    );
  } else if (account.impl === 'scdo') {
    const { publicKeyToAddress } =
      await import('../../vaults/impls/scdo/utils');
    derivedAddress = publicKeyToAddress(Buffer.from(publicKey, 'hex'));
  } else {
    const api = getCoreChainApiScopeByImpl({ impl: account.impl }).hd;
    const derived = await api.getAddressFromPublic({
      networkInfo,
      publicKey,
      addressEncoding: deriveInfo.addressEncoding,
    });
    derivedAddress = derived.address;
    derivedAddresses = derived.addresses;
  }
  if (!isCurrent()) return false;
  if (account.impl === 'nexa') {
    if (
      account.address.toLowerCase() !== publicKey.toLowerCase() ||
      !account.addresses?.[account.networkId]
    )
      return false;
    for (const [id, value] of Object.entries(account.addresses)) {
      let expectedAddress = derivedAddresses?.[id];
      if (id !== account.networkId) {
        const childNetwork = await publicNetworkInfo(id, vault);
        if (!isCurrent()) return false;
        if (childNetwork.networkImpl !== 'nexa') return false;
        const derived = await coreChainApi.nexa.hd.getAddressFromPublic({
          networkInfo: childNetwork,
          publicKey,
        });
        expectedAddress = derived.addresses?.[id];
      }
      if (!isCurrent() || expectedAddress !== value) return false;
    }
    return isCurrent();
  }
  const expected = await vault.validateAddress(derivedAddress);
  return (
    isCurrent() &&
    expected.isValid &&
    expected.normalizedAddress === address?.normalizedAddress &&
    Object.entries(account.addresses ?? {}).every(
      ([key, value]) =>
        account.impl === 'scdo' && key === '0/0' && value === account.address,
    )
  );
}

/** Validates public metadata only; never reads credentials or derives a seed. */
export async function validatePublicAccount(
  params: IValidationParams,
): Promise<boolean> {
  try {
    return await validatePublicAccountData(params);
  } catch (error) {
    if (error instanceof PublicAccountSnapshotUnsupportedError) throw error;
    // Untrusted public encodings may throw in chain SDKs. Do not forward their
    // inputs or raw error payloads to telemetry or ordinary account history.
    return false;
  }
}
