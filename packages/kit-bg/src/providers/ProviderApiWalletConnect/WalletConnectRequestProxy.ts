import type ProviderApiWalletConnect from './ProviderApiWalletConnect';
import type { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import type { Web3WalletTypes } from '@walletconnect/web3wallet';

export type IWalletConnectRequestOptions = {
  sessionRequest?: Web3WalletTypes.SessionRequest;
};

export abstract class WalletConnectRequestProxy {
  constructor({ client }: { client: ProviderApiWalletConnect }) {
    this.client = client;
  }

  client: ProviderApiWalletConnect;

  abstract providerName: IInjectedProviderNames;

  /*
   if (networkImpl === IMPL_APTOS) {
      request = this.aptosRequest(connector, payload);
    } else if (networkImpl === IMPL_ALGO) {
      request = this.algoRequest(connector, payload);
    } else {
      // IMPL_EVM
      request = this.ethereumRequest(connector, payload);
    }
   */
  async request<T>(
    options: IWalletConnectRequestOptions,
    data: any,
  ): Promise<T> {
    const resp = await this.client.backgroundApi.handleProviderMethods<T>({
      scope: this.providerName,
      origin: this.client.getDAppOrigin(options),
      data,
    });
    return Promise.resolve(resp.result as T);
  }

  // abstract connect(options: IWalletConnectRequestOptions): Promise<string[]>;

  // abstract getAccounts(
  //   options: IWalletConnectRequestOptions,
  // ): Promise<string[]>;

  // abstract getChainId(
  //   options: IWalletConnectRequestOptions,
  // ): Promise<number | undefined>;
}
