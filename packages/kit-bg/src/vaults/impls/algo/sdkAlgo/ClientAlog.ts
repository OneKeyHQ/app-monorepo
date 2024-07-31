import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type {
  IAlgoAccountInformation,
  ISdkAlgoAccountInformation,
  ISdkAlgoSuggestedParams,
} from '.';

export enum EAlgodMethods {
  GET_TRANSACTION_PARAMS = 'getTransactionParams',
  ACCOUNT_INFORMATION = 'accountInformation',
}

class ClientAlgo {
  private networkId: string;

  private backgroundApi: IBackgroundApi;

  constructor({
    networkId,
    backgroundApi,
  }: {
    networkId: string;
    backgroundApi: any;
  }) {
    this.networkId = networkId;
    this.backgroundApi = backgroundApi;
  }

  async getSuggestedParams(): Promise<ISdkAlgoSuggestedParams> {
    const [response] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<ISdkAlgoSuggestedParams>(
        {
          networkId: this.networkId,
          body: [
            {
              route: 'client',
              params: {
                method: EAlgodMethods.GET_TRANSACTION_PARAMS,
                params: [],
              },
            },
          ],
        },
      );

    return response;
  }

  async accountInformation(account: string): Promise<IAlgoAccountInformation> {
    const [response] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<IAlgoAccountInformation>(
        {
          networkId: this.networkId,
          body: [
            {
              route: 'client',
              params: {
                method: EAlgodMethods.ACCOUNT_INFORMATION,
                params: [account],
              },
            },
          ],
        },
      );

    return response;
  }
}

export default ClientAlgo;
