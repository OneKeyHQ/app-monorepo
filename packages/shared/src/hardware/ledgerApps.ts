import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_SOL,
  IMPL_TRON,
} from '../engine/engineConsts';
import networkUtils from '../utils/networkUtils';

import type { ChainForFingerprint } from '@onekeyfe/hwk-adapter-core';

export type ILedgerAllNetworkMethodName =
  | 'evmGetAddress'
  | 'btcGetPublicKey'
  | 'solGetAddress'
  | 'tronGetAddress';

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
    methodName: ILedgerAllNetworkMethodName;
    fingerprintChain: ChainForFingerprint;
  }
> = {
  [IMPL_EVM]: {
    appName: 'Ethereum',
    methodName: 'evmGetAddress',
    fingerprintChain: 'evm',
  },
  [IMPL_SOL]: {
    appName: 'Solana',
    methodName: 'solGetAddress',
    fingerprintChain: 'sol',
  },
  [IMPL_TRON]: {
    appName: 'Tron',
    methodName: 'tronGetAddress',
    fingerprintChain: 'tron',
  },
};

for (const network of LEDGER_BTC_FAMILY_NETWORKS) {
  LEDGER_NETWORK_CAPABILITIES[network] = {
    appName: 'Bitcoin',
    methodName: 'btcGetPublicKey',
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
  return LEDGER_NETWORK_CAPABILITIES[network];
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
