import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';

import type { ISdkAlgoSuggestedParams } from '.';

export enum EAlgodMethods {
  GET_TRANSACTION_PARAMS = 'getTransactionParams',
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
              route: 'algod',
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
}

export default ClientAlgo;
