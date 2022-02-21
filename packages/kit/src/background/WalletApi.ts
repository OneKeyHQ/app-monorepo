// TODO rename to BackgroundService, WalletService, ProviderService?
import type { SimpleAccount } from '@onekeyhq/engine/src/types/account';

import { getActiveWalletAccount } from '../hooks/redux';
import { appSelector } from '../store';
import { GeneralInitialState } from '../store/reducers/general';

class WalletApi {
  // TODO remove
  selectedAddress = '0x76f3f64cb3cd19debee51436df630a342b736c24';

  // TODO remove
  chainId = '0x1';

  // TODO remove
  accounts = [
    '0x76f3f64cb3cd19debee51436df630a342b736c24',
    '0x99f825d80cadd21d77d13b7e13d25960b40a6299',
    '0xc8f560c412b345aa6a5dce56d32d36d1af0b4f2a',
    '0xfb7def5f39f977c4d0e28a648ccb16d4f254aef0',
    '0x76b4a2de2e67ef5ee4a5050352aec077208fc7f1',
  ];

  isConnected = true; // current dapp isConnected

  getCurrentAccounts() {
    if (!this.isConnected) {
      return [];
    }
    const { account } = getActiveWalletAccount();
    // console.log('walletApi.getCurrentAccounts -------->', account);
    const account1 = account as SimpleAccount;
    if (account1 && account1.address) {
      return [account1.address];
    }
    return [];
  }

  getCurrentNetwork() {
    const { network } = getActiveWalletAccount();
    // console.log('walletApi.getCurrentNetwork -------->', network);

    // TODO chainId, networkVersion needs in activeNetwork
    return {
      chainId: '0x1',
      networkVersion: '1',
      network,
    };
  }
}

export default WalletApi;
