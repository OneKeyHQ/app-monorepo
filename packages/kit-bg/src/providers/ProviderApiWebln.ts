import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import {
  EDAppConnectionModal,
  EModalRoutes,
  EModalSendRoutes,
} from '@onekeyhq/shared/src/routes';
import type { ILNURLDetails } from '@onekeyhq/shared/types/lightning';
import type {
  IRequestInvoiceArgs,
  IRequestInvoiceResponse,
  ISignMessageResponse,
  IVerifyMessageArgs,
} from '@onekeyhq/shared/types/lightning/webln';
import { EMessageTypesCommon } from '@onekeyhq/shared/types/message';

import { findLnurl } from '../vaults/impls/lightning/sdkLightning/lnurl';

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
    // noop
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

  @providerApiMethod()
  public async signMessage(request: IJsBridgeMessagePayload) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];
    try {
      const message = (request.data as IJsonRpcRequest)?.params as string;
      if (typeof message !== 'string') {
        throw web3Errors.rpc.invalidInput();
      }

      const signature =
        await this.backgroundApi.serviceDApp.openSignMessageModal({
          request,
          unsignedMessage: {
            type: EMessageTypesCommon.SIMPLE_SIGN,
            message,
          },
          accountId: accountId ?? '',
          networkId: networkId ?? '',
        });
      console.log('webln.signMessage: ', message, signature);

      return JSON.parse(signature as any) as ISignMessageResponse;
    } catch (e) {
      console.error(`webln.signMessage error: `, e);
      throw e;
    }
  }

  @providerApiMethod()
  public async verifyMessage(request: IJsBridgeMessagePayload) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];
    try {
      const { message, signature } = (request.data as IJsonRpcRequest)
        ?.params as IVerifyMessageArgs;
      if (typeof message !== 'string' || typeof signature !== 'string') {
        throw web3Errors.rpc.invalidInput();
      }
      const result = await this.backgroundApi.serviceLightning.verifyMessage({
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        message,
        signature,
      });
      console.log('webln.verifyMessage: ', message, signature);
      if (!result.isValid) {
        throw new Error('Invalid signature');
      }
      return result.isValid;
    } catch (e) {
      console.error(`webln.verifyMessage error: `, e);
      throw e;
    }
  }

  @providerApiMethod()
  public async lnurl(request: IJsBridgeMessagePayload) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];

    const originLnurl = (request.data as IJsonRpcRequest)?.params as string;
    if (typeof originLnurl !== 'string') {
      throw web3Errors.rpc.invalidInput();
    }
    const lnurlEncoded = findLnurl(originLnurl);
    if (!lnurlEncoded) {
      return { error: 'Invalid LNURL' };
    }
    let lnurlDetails: ILNURLDetails | null;
    try {
      lnurlDetails =
        await this.backgroundApi.serviceLightning.findAndValidateLnurl({
          networkId: networkId ?? '',
          toVal: originLnurl,
        });
      if (!lnurlDetails) {
        return { error: 'Invalid LNURL' };
      }
      console.log('webln.lnurl: ', lnurlDetails);
    } catch (e) {
      console.error(`webln.lnurl error: `, e);
      return { error: 'Failed to parse LNURL' };
    }

    switch (lnurlDetails.tag) {
      case 'login': {
        return this.backgroundApi.serviceDApp.openModal({
          request,
          screens: [EModalRoutes.SendModal, EModalSendRoutes.LnurlAuth],
          params: {
            networkId,
            accountId,
            lnurlDetails,
          },
        });
      }
      case 'payRequest': {
        return this.backgroundApi.serviceDApp.openModal({
          request,
          screens: [EModalRoutes.SendModal, EModalSendRoutes.LnurlPayRequest],
          params: {
            networkId,
            accountId,
            lnurlDetails,
            transfersInfo: [
              {
                accountId,
                networkId,
                to: lnurlEncoded,
              },
            ],
          },
        });
      }
      case 'withdrawRequest': {
        return this.backgroundApi.serviceDApp.openModal({
          request,
          screens: [EModalRoutes.SendModal, EModalSendRoutes.LnurlWithdraw],
          params: {
            networkId,
            accountId,
            lnurlDetails,
          },
        });
      }
      default:
        return { error: 'not implemented' };
    }
  }

  @providerApiMethod()
  public async getBalance(request: IJsBridgeMessagePayload) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];

    if (accountId && networkId) {
      const accountInfo =
        await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
          accountId,
          networkId,
        });
      return {
        balance: new BigNumber(accountInfo.balance ?? 0).toNumber(),
        currency: 'sats',
      };
    }
  }
}

export default ProviderApiWebln;
