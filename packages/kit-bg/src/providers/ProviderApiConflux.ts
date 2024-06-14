/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';

import { conflux } from '@onekeyhq/core/src/chains/cfx/sdkCfx';
import type { IEncodedTxCfx } from '@onekeyhq/core/src/chains/cfx/types';
import type ICfxVault from '@onekeyhq/kit-bg/src/vaults/impls/cfx/Vault';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { vaultFactory } from '../vaults/factory';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiConflux extends ProviderApiBase {
  public providerName = IInjectedProviderNames.conflux;

  async _getCfxVault(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return null;
    }
    const { networkId, accountId } = accountsInfo[0].accountInfo ?? {};
    const vault = (await vaultFactory.getVault({
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    })) as ICfxVault;
    return vault;
  }

  _getCurrentNetworkExtraInfo = memoizee(
    async (request: IJsBridgeMessagePayload) => {
      let networkInfo = {
        chainId: '0x405',
        networkVersion: '1029',
      };
      const vault = await this._getCfxVault(request);
      if (!vault) {
        return networkInfo;
      }
      const status = await (await vault.getClient()).getStatus();
      networkInfo = {
        chainId: toBigIntHex(new BigNumber(status.chainId)),
        networkVersion: new BigNumber(status.networkId).toFixed(),
      };
      return networkInfo;
    },
    {
      promise: true,
      max: 1,
    },
  );

  async _showSignMessageModal(
    request: IJsBridgeMessagePayload,
    unsignedMessage: any,
  ) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    return this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage,
      accountId: accountId ?? '',
      networkId: networkId ?? '',
    });
  }

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountsChanged',
        params: await this.cfx_accounts({ origin, scope: this.providerName }),
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_chainChanged',
        params: {
          chainId: await this.cfx_chainId({ origin, scope: this.providerName }),
          networkId: await this.cfx_netVersion({
            origin,
            scope: this.providerName,
          }),
        },
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    const { data } = request;
    const { accountInfo: { networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const rpcRequest = data as IJsonRpcRequest;

    console.log(`${this.providerName} RpcCall=====>>>> : BgApi:`, request);

    const [result] = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: networkId ?? '',
      request: rpcRequest,
    });

    return result;
  }

  // ----------------------------------------------

  @providerApiMethod()
  async cfx_getProviderState(request: IJsBridgeMessagePayload) {
    const [chainId, networkId] = await Promise.all([
      this.cfx_chainId(request),
      this.cfx_netVersion(request),
    ]);
    return {
      chainId,
      networkId,
    };
  }

  @providerApiMethod()
  async cfx_accounts(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(accountsInfo.map((i) => i.account?.address));
  }

  @providerApiMethod()
  async cfx_chainId(request: IJsBridgeMessagePayload) {
    const networkExtraInfo = await this._getCurrentNetworkExtraInfo(request);
    return networkExtraInfo.chainId;
  }

  @providerApiMethod()
  cfx_getMaxGasLimit() {
    // This rpc method is not standard
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  async cfx_getNextUsableNonce(
    request: IJsBridgeMessagePayload,
    ...params: any[]
  ) {
    return this.rpcCall({
      ...request,
      data: {
        method: 'cfx_getNextNonce',
        params,
      },
    });
  }

  @providerApiMethod()
  async cfx_netVersion(request: IJsBridgeMessagePayload) {
    const networkExtraInfo = await this._getCurrentNetworkExtraInfo(request);
    return networkExtraInfo.networkVersion;
  }

  @providerApiMethod()
  async cfx_requestAccounts(request: IJsBridgeMessagePayload) {
    console.log('ProviderApiConflux.cfx_requestAccounts', request);

    const accounts = await this.cfx_accounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.cfx_accounts(request);
  }

  @permissionRequired()
  @providerApiMethod()
  async cfx_sendTransaction(
    request: IJsBridgeMessagePayload,
    transaction: IEncodedTxCfx,
  ) {
    console.log('cfx_sendTransaction', request, transaction);

    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const gasPrice = new BigNumber(transaction.gasPrice ?? 0);

    if (gasPrice.isLessThan(conflux.CONST.MIN_GAS_PRICE)) {
      delete transaction.gasPrice;
    }

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: transaction,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });

    console.log('cfx_sendTransaction DONE', result, request, transaction);

    return result.txid;
  }

  @providerApiMethod()
  cfx_signTypedData_v4(request: IJsBridgeMessagePayload, ...messages: any[]) {
    return this._showSignMessageModal(request, {
      type: EMessageTypesEth.TYPED_DATA_V4,
      message: messages[1],
      payload: messages,
    });
  }

  @providerApiMethod()
  async net_version(request: IJsBridgeMessagePayload) {
    return this.cfx_netVersion(request);
  }

  @providerApiMethod()
  async personal_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    const message = messages[0];

    return this._showSignMessageModal(request, {
      type: EMessageTypesEth.PERSONAL_SIGN,
      message,
      payload: messages,
    });
  }

  @providerApiMethod()
  cfx_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    return this._showSignMessageModal(request, {
      type: EMessageTypesEth.ETH_SIGN,
      message: messages[1],
      payload: messages,
    });
  }

  @providerApiMethod()
  wallet_addConfluxChain() {
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  wallet_getBalance(request: IJsBridgeMessagePayload, ...params: any[]) {
    return this.rpcCall({
      ...request,
      data: {
        method: 'cfx_getBalance',
        params,
      },
    });
  }

  @providerApiMethod()
  wallet_getBlockTime() {
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  wallet_getBlockchainExplorerUrl() {
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  async wallet_requestPermissions(request: IJsBridgeMessagePayload) {
    return this.cfx_requestAccounts(request);
  }

  @providerApiMethod()
  async wallet_sendTransaction(
    request: IJsBridgeMessagePayload,
    transaction: IEncodedTxCfx,
  ) {
    return this.cfx_sendTransaction(request, transaction);
  }

  @providerApiMethod()
  wallet_switchConfluxChain() {
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  wallet_switchEthereumChain() {
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  wallet_validateMnemonic() {
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  wallet_validatePrivateKey() {
    throw web3Errors.provider.unsupportedMethod();
  }

  @permissionRequired()
  @providerApiMethod()
  async wallet_watchAsset() {
    throw web3Errors.provider.unsupportedMethod();
  }
}

export default ProviderApiConflux;
