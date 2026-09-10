import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_SOL,
  IMPL_TRON,
} from '../../engine/engineConsts';
import networkUtils from '../../utils/networkUtils';

import { getAllNetworkAddressMethod } from './allNetworkAddress';

import type { ChainForFingerprint } from '@onekeyfe/hwk-adapter-core';

export const LEDGER_CONFIG = {
  // Individual calls may override the SDK app-install default.
  autoInstallApp: true,
  // Opt in to opening another chain app before recording a missing fingerprint.
  // Existing target-chain fingerprints are always verified independently.
  enableCrossChainFingerprintVerification: false,
};

export const LEDGER_FINGERPRINT_CHAINS: readonly ChainForFingerprint[] = [
  'evm',
  'btc',
  'sol',
  'tron',
];

export const LEDGER_CORE_APPS = [
  'Bitcoin',
  'Ethereum',
  'Solana',
  'Tron',
] as const;

export type ILedgerCoreAppName = (typeof LEDGER_CORE_APPS)[number];

export const LEDGER_BTC_FAMILY_NETWORKS = [IMPL_BTC] as const;
const LEDGER_NETWORK_CAPABILITIES: Record<
  string,
  {
    appName: ILedgerCoreAppName;
    fingerprintChain: ChainForFingerprint;
  }
> = {
  [IMPL_EVM]: {
    appName: 'Ethereum',
    fingerprintChain: 'evm',
  },
  [IMPL_SOL]: {
    appName: 'Solana',
    fingerprintChain: 'sol',
  },
  [IMPL_TRON]: {
    appName: 'Tron',
    fingerprintChain: 'tron',
  },
};

for (const network of LEDGER_BTC_FAMILY_NETWORKS) {
  LEDGER_NETWORK_CAPABILITIES[network] = {
    appName: 'Bitcoin',
    fingerprintChain: 'btc',
  };
}

export function getLedgerNetworkCapability({
  network,
}: {
  network: string | undefined;
}) {
  if (!network) {
    return undefined;
  }
  const capability = LEDGER_NETWORK_CAPABILITIES[network];
  return capability
    ? { ...capability, methodName: getAllNetworkAddressMethod(network) }
    : undefined;
}

export function getLedgerAppNameOfNetwork({
  networkId,
}: {
  networkId: string;
}): ILedgerCoreAppName | undefined {
  if (networkUtils.isAllNetwork({ networkId })) {
    return undefined;
  }
  const impl = networkUtils.getNetworkImpl({ networkId });
  return getLedgerNetworkCapability({ network: impl })?.appName;
}

export function buildRequiredLedgerAppNamesForNetworks(
  networks: Array<{ networkId: string }>,
): ILedgerCoreAppName[] {
  const requiredApps: ILedgerCoreAppName[] = [];
  const appNameMap: Partial<Record<ILedgerCoreAppName, true>> = {};
  for (const network of networks) {
    const appName = getLedgerAppNameOfNetwork({
      networkId: network.networkId,
    });
    if (appName && !appNameMap[appName]) {
      appNameMap[appName] = true;
      requiredApps.push(appName);
    }
  }
  return requiredApps;
}

export function hasAnyRequiredLedgerAppInstalled({
  installedApps,
  requiredApps,
}: {
  installedApps: string[];
  requiredApps: string[];
}) {
  const installedAppMap = new Set(
    installedApps.map((appName) => appName.toLowerCase()),
  );
  return requiredApps.some((appName) =>
    installedAppMap.has(appName.toLowerCase()),
  );
}
