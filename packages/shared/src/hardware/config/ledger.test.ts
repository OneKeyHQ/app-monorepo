import { getNetworkIdsMap } from '../../config/networkIds';

import {
  LEDGER_CONFIG,
  LEDGER_CORE_APPS,
  LEDGER_FINGERPRINT_CHAINS,
  buildRequiredLedgerAppNamesForNetworks,
  getLedgerNetworkCapability,
  hasAnyRequiredLedgerAppInstalled,
} from './ledger';

describe('ledgerApps', () => {
  it('keeps Ledger policy defaults in the same configuration as app mappings', () => {
    expect(LEDGER_CONFIG).toEqual({
      autoInstallApp: true,
      enableCrossChainFingerprintVerification: false,
    });
  });

  it('keeps fingerprint chains and supported app mappings aligned', () => {
    const apps = LEDGER_FINGERPRINT_CHAINS.map((network) => {
      const capability = getLedgerNetworkCapability({ network });
      expect(capability?.fingerprintChain).toBe(network);
      return capability?.appName;
    });
    expect(new Set(apps)).toEqual(new Set(LEDGER_CORE_APPS));
  });
  it('builds required Ledger app names from real networks and ignores all-network entries', () => {
    const networkIdsMap = getNetworkIdsMap();

    expect(
      buildRequiredLedgerAppNamesForNetworks([
        { networkId: networkIdsMap.onekeyall },
        { networkId: networkIdsMap.btc },
        { networkId: networkIdsMap.eth },
        { networkId: networkIdsMap.sol },
        { networkId: networkIdsMap.trx },
        { networkId: networkIdsMap.doge },
        { networkId: networkIdsMap.eth },
      ]),
    ).toEqual(['Bitcoin', 'Ethereum', 'Solana', 'Tron']);
  });

  it('detects whether any required Ledger app is already installed', () => {
    expect(
      hasAnyRequiredLedgerAppInstalled({
        installedApps: ['Solana'],
        requiredApps: ['Bitcoin', 'Ethereum', 'Solana'],
      }),
    ).toBe(true);

    expect(
      hasAnyRequiredLedgerAppInstalled({
        installedApps: ['Litecoin'],
        requiredApps: ['Bitcoin', 'Ethereum'],
      }),
    ).toBe(false);
  });
});
