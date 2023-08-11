import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { RequestInvoiceArgs } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/webln';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_LIGHTNING } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiWebln extends ProviderApiBase {
  public providerName = IInjectedProviderNames.webln;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: await this.getConnectedAccount({ origin }),
        },
      };
      return result;
    };

    info.send(data);
  }

  private getConnectedAccount(request: IJsBridgeMessagePayload) {
    const [account] = this.backgroundApi.serviceDapp.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_LIGHTNING,
      },
    );

    return Promise.resolve({ address: account.address });
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // TODO
    debugLogger.providerApi.info(info);
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    return Promise.resolve();
  }

  // WEBLN API
  @providerApiMethod()
  public async enable(request: IJsBridgeMessagePayload) {
    try {
      await this.backgroundApi.serviceDapp.openConnectionModal(request);
      return { enabled: true };
    } catch (error) {
      console.error('===>>>enable error:::::', error);
      throw error;
    }
  }

  @providerApiMethod()
  public async getInfo() {
    return Promise.resolve({
      // TODO: add getinfo api
      node: {
        alias: 'OneKey',
      },
      methods: ['getInfo', 'makeInvoice', 'sendPayment', 'signMessage'],
      supports: ['lightning'],
    });
  }

  @providerApiMethod()
  public async makeInvoice(request: IJsBridgeMessagePayload) {
    try {
      const params = (request.data as IJsonRpcRequest)
        ?.params as RequestInvoiceArgs;
      const { paymentRequest, paymentHash } =
        await this.backgroundApi.serviceDapp.openWeblnMakeInvoiceModal(
          request,
          params,
        );
      return { paymentRequest, paymentHash, rHash: paymentHash };
    } catch (e) {
      console.error('=====>makeinvoice error: ', e);
      throw e;
    }
  }

  @providerApiMethod()
  public async sendPayment(request: IJsBridgeMessagePayload) {
    try {
      const paymentRequest = (request.data as IJsonRpcRequest)
        ?.params as string;
      const { networkId, accountId } = getActiveWalletAccount();
      const txid =
        await this.backgroundApi.serviceDapp.openWeblnSendPaymentModal(
          request,
          {
            paymentRequest,
            networkId,
            accountId,
          },
        );
      const invoice =
        await this.backgroundApi.serviceLightningNetwork.fetchSpecialInvoice({
          paymentHash: txid,
          networkId,
          accountId,
        });
      return { preimage: invoice.payment_preimage };
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}

export default ProviderApiWebln;
