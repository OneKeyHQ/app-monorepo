import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';
import type { ChainForFingerprint } from '@onekeyfe/hwk-adapter-core';

export type IThirdPartyAllNetworkAddressParams = AllNetworkAddressParams & {
  methodName?:
    | 'evmGetAddress'
    | 'btcGetAddress'
    | 'btcGetPublicKey'
    | 'solGetAddress'
    | 'tronGetAddress';
  showOnDevice?: boolean;
  chainId?: number;
};

const BTC_NETWORKS = new Set<AllNetworkAddressParams['network']>([
  'btc',
  'tbtc',
  'bch',
  'doge',
  'ltc',
  'neurai',
]);

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
  const normalized: IThirdPartyAllNetworkAddressParams = { ...item };
  const showOnDevice = getShowOnDevice(item);

  if (showOnDevice !== undefined) {
    normalized.showOnDevice = showOnDevice;
  }

  if (item.network === 'evm') {
    normalized.methodName ??= 'evmGetAddress';
    normalized.chainId ??= parseChainId(item.chainName);
  } else if (BTC_NETWORKS.has(item.network)) {
    normalized.methodName ??= 'btcGetPublicKey';
  } else if (item.network === 'sol') {
    normalized.methodName ??= 'solGetAddress';
  } else if (item.network === 'tron') {
    normalized.methodName ??= 'tronGetAddress';
  }

  return normalized;
}

export function normalizeThirdPartyAllNetworkBundle(
  bundle: AllNetworkAddressParams[],
): IThirdPartyAllNetworkAddressParams[] {
  return bundle.map(normalizeItem);
}

function getLedgerFingerprintChain(
  item: AllNetworkAddressParams,
): ChainForFingerprint | undefined {
  if (item.network === 'evm') {
    return 'evm';
  }
  if (BTC_NETWORKS.has(item.network)) {
    return 'btc';
  }
  if (item.network === 'sol') {
    return 'sol';
  }
  if (item.network === 'tron') {
    return 'tron';
  }
  return undefined;
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
