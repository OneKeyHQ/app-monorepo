import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_SOL,
  IMPL_TRON,
} from '../engine/engineConsts';
import networkUtils from '../utils/networkUtils';

export const LEDGER_CORE_APPS = [
  'Bitcoin',
  'Ethereum',
  'Solana',
  'Tron',
] as const;

export type ILedgerCoreAppName = (typeof LEDGER_CORE_APPS)[number];

export function getLedgerAppNameOfNetwork({
  networkId,
}: {
  networkId: string;
}): ILedgerCoreAppName | undefined {
  if (networkUtils.isAllNetwork({ networkId })) {
    return undefined;
  }
  const impl = networkUtils.getNetworkImpl({ networkId });
  if (impl === IMPL_BTC) {
    return 'Bitcoin';
  }
  if (impl === IMPL_EVM) {
    return 'Ethereum';
  }
  if (impl === IMPL_SOL) {
    return 'Solana';
  }
  if (impl === IMPL_TRON) {
    return 'Tron';
  }
  return undefined;
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
