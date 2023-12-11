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
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
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
    debugLogger.providerApi.info('webln rpcCall: ', request);
    return Promise.resolve();
  }

  // WEBLN API
  @providerApiMethod()
  public async enable(request: IJsBridgeMessagePayload) {
    try {
      const accountEnabled = await this.getEnabledAccount(request);
      if (accountEnabled) {
        return { enabled: true };
      }
      await this.backgroundApi.serviceDapp.openConnectionModal(request);
      return { enabled: true };
    } catch (error) {
      debugLogger.providerApi.error(`webln.enable error: `, error);
      throw error;
    }
  }

  private async getEnabledAccount(request: IJsBridgeMessagePayload) {
    const { networkId, accountId } = getActiveWalletAccount();
    try {
      const accounts =
        this.backgroundApi.serviceDapp?.getActiveConnectedAccounts({
          origin: request.origin as string,
          impl: IMPL_LIGHTNING,
        });
      if (!accounts) {
        return false;
      }
      const accountAddresses = accounts.map((account) => account.address);

      const account = await this.backgroundApi.engine.getAccount(
        accountId,
        networkId,
      );
      if (account.addresses) {
        const addresses = JSON.parse(account.addresses) as {
          hashAddress?: string;
        };
        if (addresses.hashAddress) {
          return accountAddresses.includes(addresses.hashAddress);
        }
      }
      return false;
    } catch {
      return false;
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
      const { paymentRequest, paymentHash } =
        (await this.backgroundApi.serviceDapp.openModal({
          request,
          screens: [ModalRoutes.Webln, WeblnModalRoutes.MakeInvoice],
          params,
        })) as RequestInvoiceResponse;
      debugLogger.providerApi.info('webln.makeInvoice: ', paymentRequest);
      return { paymentRequest, paymentHash, rHash: paymentHash };
    } catch (e) {
      debugLogger.providerApi.error(`webln.makeInvoice error: `, e);
      throw e;
    }
  }

  @providerApiMethod()
  public async sendPayment(request: IJsBridgeMessagePayload) {
    try {
      const paymentRequest = (request.data as IJsonRpcRequest)
        ?.params as string;
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
      debugLogger.providerApi.info('webln.sendPayment: ', txid, invoice);
      return { preimage: invoice.payment_preimage };
    } catch (e) {
      debugLogger.providerApi.error(`webln.sendPayment error: `, e);
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
      debugLogger.providerApi.info('webln.signMessage: ', message, signature);
      return JSON.parse(signature as string) as SignMessageResponse;
    } catch (e) {
      debugLogger.providerApi.error(`webln.signMessage error: `, e);
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
      debugLogger.providerApi.info('webln.verifyMessage: ', message, signature);
    } catch (e) {
      debugLogger.providerApi.error(`webln.verifyMessage error: `, e);
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
      debugLogger.providerApi.info('webln.lnurl: ', lnurlDetails);
    } catch (e) {
      debugLogger.providerApi.error(`webln.lnurl error: `, e);
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
    debugLogger.providerApi.info('webln.getBalance: ', result, accountId);
    return result;
  }
}

export default ProviderApiWebln;
