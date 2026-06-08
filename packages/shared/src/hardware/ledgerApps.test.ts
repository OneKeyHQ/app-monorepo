import { getNetworkIdsMap } from '../config/networkIds';

import {
  buildRequiredLedgerAppNamesForNetworks,
  hasAnyRequiredLedgerAppInstalled,
} from './ledgerApps';

describe('ledgerApps', () => {
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
