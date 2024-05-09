import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EDAppConnectionModal,
  EModalRoutes,
  EModalSendRoutes,
} from '@onekeyhq/shared/src/routes';
import type {
  IRequestInvoiceArgs,
  IRequestInvoiceResponse,
} from '@onekeyhq/shared/types/lightning/webln';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiWebln extends ProviderApiBase {
  public providerName = IInjectedProviderNames.webln;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = () => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: undefined,
        },
      };
      return result;
    };

    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(): void {
    throw new Error('Method not implemented.');
  }

  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    console.log('webln rpcCall: ', request);
    return Promise.resolve();
  }

  _getAccountsInfo = async (request: IJsBridgeMessagePayload) => {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      throw web3Errors.provider.unauthorized();
    }
    return accountsInfo;
  };

  // WEBLN API
  @providerApiMethod()
  public async enable(request: IJsBridgeMessagePayload) {
    try {
      const accountsInfo = await this._getAccountsInfo(request);
      if (accountsInfo.length > 0) {
        return { enabled: true };
      }
      throw web3Errors.provider.unauthorized();
    } catch (e) {
      await this.backgroundApi.serviceDApp.openConnectionModal(request);
      const accountsInfo = await this._getAccountsInfo(request);
      return { enabled: accountsInfo.length > 0 };
    }
  }

  @providerApiMethod()
  public async getInfo() {
    return Promise.resolve({
      node: {
        alias: 'OneKey',
      },
      methods: [
        'getInfo',
        'makeInvoice',
        'sendPayment',
        'signMessage',
        'verifyMessage',
        'lnurl',
        'on',
        'off',
        'getBalance',
      ],
      supports: ['lightning'],
    });
  }

  @providerApiMethod()
  public async makeInvoice(request: IJsBridgeMessagePayload) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];
    try {
      const params = (request.data as IJsonRpcRequest)
        ?.params as IRequestInvoiceArgs;
      const { paymentRequest, paymentHash } =
        (await this.backgroundApi.serviceDApp.openModal({
          request,
          screens: [
            EModalRoutes.DAppConnectionModal,
            EDAppConnectionModal.MakeInvoice,
          ],
          params: {
            ...params,
            accountId,
            networkId,
          },
        })) as IRequestInvoiceResponse;
      console.log('webln.makeInvoice: ', paymentRequest);
      return { paymentRequest, paymentHash, rHash: paymentHash };
    } catch (e) {
      console.log(`webln.makeInvoice error: `, e);
      throw e;
    }
  }

  @providerApiMethod()
  public async sendPayment(request: IJsBridgeMessagePayload) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];
    try {
      const paymentRequest = (request.data as IJsonRpcRequest)
        ?.params as string;
      const txid = (await this.backgroundApi.serviceDApp.openModal({
        request,
        screens: [EModalRoutes.SendModal, EModalSendRoutes.WeblnSendPayment],
        params: {
          paymentRequest,
          networkId,
          accountId,
        },
      })) as string;
      const invoice =
        await this.backgroundApi.serviceLightning.fetchSpecialInvoice({
          paymentHash: txid,
          networkId: networkId ?? '',
          accountId: accountId ?? '',
        });
      console.log('webln.sendPayment: ', txid, invoice);
      return { preimage: invoice.payment_preimage };
    } catch (e) {
      console.error(`webln.sendPayment error: `, e);
      throw e;
    }
  }
}

export default ProviderApiWebln;
