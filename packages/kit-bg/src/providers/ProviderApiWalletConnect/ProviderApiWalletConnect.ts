import { Core } from '@walletconnect/core';
import { Web3Wallet } from '@walletconnect/web3wallet';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  WALLET_CONNECT_CLIENT_META,
  WALLET_CONNECT_V2_PROJECT_ID,
} from '@onekeyhq/shared/src/consts/walletConnectConsts';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IWeb3Wallet } from '@walletconnect/web3wallet';

class ProviderApiWalletConnect {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    this.backgroundApi = backgroundApi;

    console.log('=====>>>> ProviderApiWalletConnect Initalize');
  }

  backgroundApi: IBackgroundApi;

  web3Wallet?: IWeb3Wallet;

  @backgroundMethod()
  async initialize() {
    const core = new Core({
      projectId: WALLET_CONNECT_V2_PROJECT_ID,
    });
    this.web3Wallet = await Web3Wallet.init({
      core,
      metadata: WALLET_CONNECT_CLIENT_META,
    });
    console.log('bar');
  }
}

export default ProviderApiWalletConnect;
