import {
  type IAllNetworkAddressMethodName,
  getAllNetworkAddressMethod,
} from '@onekeyhq/shared/src/hardware/config/allNetworkAddress';
import { getLedgerNetworkCapability } from '@onekeyhq/shared/src/hardware/config/ledger';

import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';
import type { ChainForFingerprint } from '@onekeyfe/hwk-adapter-core';

export type IThirdPartyAllNetworkAddressParams = AllNetworkAddressParams & {
  methodName?: IAllNetworkAddressMethodName | 'btcGetAddress';
  showOnDevice?: boolean;
  chainId?: number;
};

function parseChainId(chainName: string | undefined): number | undefined {
  if (!chainName) {
    return undefined;
  }
  const chainId = parseInt(chainName, 10);
  return Number.isFinite(chainId) ? chainId : undefined;
}

function getShowOnDevice(item: AllNetworkAddressParams): boolean | undefined {
  const showOnDevice = (item as { showOnDevice?: boolean }).showOnDevice;
  return showOnDevice ?? item.showOnOneKey;
}

function normalizeItem(
  item: AllNetworkAddressParams,
): IThirdPartyAllNetworkAddressParams {
  const {
    autoInstallApp: _autoInstallApp,
    passphraseState: _passphraseState,
    useEmptyPassphrase: _useEmptyPassphrase,
    ...itemParams
  } = item as AllNetworkAddressParams & {
    autoInstallApp?: boolean;
    passphraseState?: string;
    useEmptyPassphrase?: boolean;
  };
  const normalized: IThirdPartyAllNetworkAddressParams = { ...itemParams };
  const showOnDevice = getShowOnDevice(item);

  if (showOnDevice !== undefined) {
    normalized.showOnDevice = showOnDevice;
  }

  const methodName = getAllNetworkAddressMethod(item.network);
  if (methodName) normalized.methodName ??= methodName;

  if (normalized.methodName === 'evmGetAddress') {
    normalized.chainId ??= parseChainId(item.chainName);
  }

  return normalized;
}

export function normalizeThirdPartyAllNetworkBundle(
  bundle: AllNetworkAddressParams[],
): IThirdPartyAllNetworkAddressParams[] {
  return bundle.map(normalizeItem);
}

export function shouldUseThirdPartyAllNetworkGetAddress({
  isThirdPartyWallet,
  supportsAllNetworkGetAddress,
  hasAllNetworkGetAddress,
}: {
  isThirdPartyWallet: boolean;
  isVerifyAddressAction?: boolean;
  supportsAllNetworkGetAddress?: boolean;
  hasAllNetworkGetAddress?: boolean;
}): boolean {
  return (
    isThirdPartyWallet &&
    !!supportsAllNetworkGetAddress &&
    !!hasAllNetworkGetAddress
  );
}

function getLedgerFingerprintChain(
  item: AllNetworkAddressParams,
): ChainForFingerprint | undefined {
  return getLedgerNetworkCapability({
    network: item.network,
  })?.fingerprintChain;
}

function getDeviceChainFingerprints(
  settingsRaw: string | undefined,
): Partial<Record<ChainForFingerprint, string>> {
  if (!settingsRaw) {
    return {};
  }
  try {
    const settings = JSON.parse(settingsRaw) as {
      chainFingerprints?: Partial<Record<ChainForFingerprint, string>>;
    };
    return settings.chainFingerprints ?? {};
  } catch {
    return {};
  }
}

export function attachLedgerAllNetworkFingerprints({
  bundle,
  settingsRaw,
}: {
  bundle: AllNetworkAddressParams[];
  settingsRaw: string | undefined;
}): boolean {
  const fingerprints = getDeviceChainFingerprints(settingsRaw);
  for (const item of bundle) {
    const chain = getLedgerFingerprintChain(item);
    if (chain) {
      const fingerprint = fingerprints[chain];
      if (fingerprint) {
        (item as AllNetworkAddressParams & { deviceId?: string }).deviceId =
          fingerprint;
      }
    }
  }
  return true;
}

export function getMissingLedgerFingerprintChains({
  bundle,
  settingsRaw,
}: {
  bundle: AllNetworkAddressParams[];
  settingsRaw: string | undefined;
}): ChainForFingerprint[] {
  const fingerprints = getDeviceChainFingerprints(settingsRaw);
  const missing = new Set<ChainForFingerprint>();
  for (const item of bundle) {
    const chain = getLedgerFingerprintChain(item);
    if (chain && !fingerprints[chain]) {
      missing.add(chain);
    }
  }
  return Array.from(missing);
}
