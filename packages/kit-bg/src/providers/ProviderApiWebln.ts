import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { CommonMessageTypes } from '@onekeyhq/engine/src/types/message';
import {
  findLnurl,
  getLnurlDetails,
  isLNURLRequestError,
} from '@onekeyhq/engine/src/vaults/impl/lightning-network/helper/lnurl';
import type {
  RequestInvoiceArgs,
  RequestInvoiceResponse,
  SignMessageResponse,
  VerifyMessageArgs,
} from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/webln';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  ModalRoutes,
  SendModalRoutes,
  WeblnModalRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
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

    return Promise.resolve({ address: account?.address });
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // TODO
    debugLogger.providerApi.info(info);
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    console.log('===>>>rpcCall: ', request);
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
    try {
      const params = (request.data as IJsonRpcRequest)
        ?.params as RequestInvoiceArgs;
      console.log('===> request: ', params);
      const { paymentRequest, paymentHash } =
        (await this.backgroundApi.serviceDapp.openModal({
          request,
          screens: [ModalRoutes.Webln, WeblnModalRoutes.MakeInvoice],
          params,
        })) as RequestInvoiceResponse;
      console.log('=====>makeinvoice request: ', paymentRequest);
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
      console.log('===> request: ', paymentRequest);
      const { networkId, accountId } = getActiveWalletAccount();
      const txid = (await this.backgroundApi.serviceDapp.openModal({
        request,
        screens: [ModalRoutes.Send, SendModalRoutes.WeblnSendPayment],
        params: {
          paymentRequest,
          networkId,
          accountId,
        },
      })) as string;
      const invoice =
        await this.backgroundApi.serviceLightningNetwork.fetchSpecialInvoice({
          paymentHash: txid,
          networkId,
          accountId,
        });
      console.log('=====>sendpayment request: ', txid);
      return { preimage: invoice.payment_preimage };
    } catch (e) {
      console.error('=====>sendPayment error: ', e);
      throw e;
    }
  }

  @providerApiMethod()
  public async signMessage(request: IJsBridgeMessagePayload) {
    try {
      const message = (request.data as IJsonRpcRequest)?.params as string;
      if (typeof message !== 'string') {
        throw web3Errors.rpc.invalidInput();
      }

      const signature =
        await this.backgroundApi.serviceDapp?.openSignAndSendModal(request, {
          unsignedMessage: {
            type: CommonMessageTypes.SIMPLE_SIGN,
            message,
          },
        });
      console.log('====> signature: ', signature);
      return JSON.parse(signature as string) as SignMessageResponse;
    } catch (e) {
      console.error('=====>signature error: ', e);
      throw e;
    }
  }

  @providerApiMethod()
  public async verifyMessage(request: IJsBridgeMessagePayload) {
    try {
      const { message, signature } = (request.data as IJsonRpcRequest)
        ?.params as VerifyMessageArgs;
      if (typeof message !== 'string' || typeof signature !== 'string') {
        throw web3Errors.rpc.invalidInput();
      }
      const { networkId, accountId } = getActiveWalletAccount();
      await this.backgroundApi.serviceDapp.openModal({
        request,
        screens: [ModalRoutes.Webln, WeblnModalRoutes.VerifyMessage],
        params: {
          message,
          signature,
          networkId,
          accountId,
        },
      });
      console.log('====> verifyMessage: ', message, signature);
    } catch (e) {
      console.error('=====>verifyMessage error: ', e);
      throw e;
    }
  }

  @providerApiMethod()
  public async lnurl(request: IJsBridgeMessagePayload) {
    const originLnurl = (request.data as IJsonRpcRequest)?.params as string;
    if (typeof originLnurl !== 'string') {
      throw web3Errors.rpc.invalidInput();
    }
    const lnurlEncoded = findLnurl(originLnurl);
    if (!lnurlEncoded) {
      return { error: 'Invalid LNURL' };
    }
    let lnurlDetails;
    try {
      lnurlDetails = await getLnurlDetails(lnurlEncoded);
      if (isLNURLRequestError(lnurlDetails)) {
        return { error: lnurlDetails.reason };
      }
    } catch (e) {
      console.error('parse lnurl error: ', e);
      return { error: 'Failed to parse LNURL' };
    }

    const { networkId, accountId, walletId } = getActiveWalletAccount();
    switch (lnurlDetails.tag) {
      case 'login': {
        return this.backgroundApi.serviceDapp.openModal({
          request,
          screens: [ModalRoutes.Send, SendModalRoutes.LNURLAuth],
          params: {
            walletId,
            networkId,
            accountId,
            lnurlDetails,
          },
        });
      }
      case 'payRequest': {
        return this.backgroundApi.serviceDapp.openModal({
          request,
          screens: [ModalRoutes.Send, SendModalRoutes.LNURLPayRequest],
          params: {
            networkId,
            accountId,
            walletId,
            lnurlDetails,
            transferInfo: {
              accountId,
              networkId,
              to: lnurlEncoded,
            },
          },
        });
      }
      case 'withdrawRequest': {
        return this.backgroundApi.serviceDapp.openModal({
          request,
          screens: [ModalRoutes.Send, SendModalRoutes.LNURLWithdraw],
          params: {
            networkId,
            accountId,
            walletId,
            lnurlDetails,
          },
        });
      }
      default:
        return { error: 'not implemented' };
    }
  }

  @providerApiMethod()
  public async getBalance() {
    const { networkId, accountId } = getActiveWalletAccount();
    const result =
      await this.backgroundApi.serviceLightningNetwork.weblnGetBalance({
        accountId,
        networkId,
      });
    console.log('====> getBalance: ', result);
    return result;
  }
}

export default ProviderApiWebln;
