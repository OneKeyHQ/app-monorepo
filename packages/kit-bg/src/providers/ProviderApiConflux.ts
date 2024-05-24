/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';

import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import type { EvmExtraInfo } from '@onekeyhq/engine/src/types/network';
import { conflux } from '@onekeyhq/engine/src/vaults/impl/cfx/sdk';
import type { IEncodedTxCfx } from '@onekeyhq/engine/src/vaults/impl/cfx/Vault';
import type VaultConflux from '@onekeyhq/engine/src/vaults/impl/cfx/Vault';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_CFX } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

export type WatchAssetParameters = {
  type: string;
  options: {
    address: string;
    symbol?: string;
    decimals?: number;
    image?: string;
  };
};

export type AddConfluxChainParameter = {
  chainId: string;
  blockExplorerUrls?: string[];
  chainName?: string;
  iconUrls?: string[];
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls?: string[];
};

export type SwitchConfluxChainParameter = {
  chainId: string;
};

@backgroundClass()
class ProviderApiConflux extends ProviderApiBase {
  public providerName = IInjectedProviderNames.conflux;

  _getCurrentNetworkExtraInfoCache = memoizee(
    async (accountId, networkId, networkImpl) => {
      let networkInfo: EvmExtraInfo = {
        chainId: '0x405',
        networkVersion: '1029',
      };

      if (networkImpl !== IMPL_CFX) {
        return networkInfo;
      }

      const vault = (await this.backgroundApi.engine.getVault({
        networkId,
        accountId,
      })) as VaultConflux;

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

  async _getCurrentNetworkExtraInfo(): Promise<EvmExtraInfo> {
    const { accountId, networkId, networkImpl } = getActiveWalletAccount();
    return this._getCurrentNetworkExtraInfoCache(
      accountId,
      networkId,
      networkImpl,
    );
  }

  async _showSignMessageModal(
    request: IJsBridgeMessagePayload,
    unsignedMessage: any,
  ) {
    const result = await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        unsignedMessage,
      },
    );
    return result;
  }

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountsChanged',
        params: await this.cfx_accounts({ origin }),
      };
      return result;
    };
    info.send(data);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async () => {
      const result = {
        method: 'wallet_events_chainChanged',
        params: {
          chainId: await this.cfx_chainId(),
          networkId: await this.cfx_netVersion(),
        },
      };
      return result;
    };
    info.send(data);
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    const { networkId, networkImpl } = getActiveWalletAccount();

    if (networkImpl !== IMPL_CFX) {
      return;
    }

    debugLogger.providerApi.info('conflux rpcCall:', request, { networkId });
    const result = await this.backgroundApi.engine.proxyJsonRPCCall(
      networkId,
      request,
    );
    debugLogger.providerApi.info('conflux rpcCall RESULT:', request, {
      networkId,
      result,
    });
    return result;
  }

  // ----------------------------------------------

  @providerApiMethod()
  async cfx_getProviderState() {
    const [chainId, networkId] = await Promise.all([
      this.cfx_chainId(),
      this.cfx_netVersion(),
    ]);
    return {
      chainId,
      networkId,
    };
  }

  @providerApiMethod()
  async cfx_accounts(request: IJsBridgeMessagePayload) {
    const accounts = this.backgroundApi.serviceDapp?.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_CFX,
      },
    );
    if (!accounts) {
      return Promise.resolve([]);
    }
    const accountAddresses = accounts.map((account) => account.address);
    return Promise.resolve(accountAddresses);
  }

  @providerApiMethod()
  async cfx_chainId() {
    const networkExtraInfo = await this._getCurrentNetworkExtraInfo();
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
      method: 'cfx_getNextNonce',
      params,
    });
  }

  @providerApiMethod()
  async cfx_netVersion() {
    const networkExtraInfo = await this._getCurrentNetworkExtraInfo();
    return networkExtraInfo.networkVersion;
  }

  @providerApiMethod()
  async cfx_requestAccounts(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info(
      'ProviderApiConflux.cfx_requestAccounts',
      request,
    );

    const accounts = await this.cfx_accounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }

    await this.backgroundApi.serviceDapp.openConnectionModal(request);
    return this.cfx_accounts(request);
  }

  @permissionRequired()
  @providerApiMethod()
  async cfx_sendTransaction(
    request: IJsBridgeMessagePayload,
    transaction: IEncodedTxCfx,
  ) {
    const gasPrice = new BigNumber(transaction.gasPrice ?? 0);

    if (gasPrice.isLessThan(conflux.CONST.MIN_GAS_PRICE)) {
      delete transaction.gasPrice;
    }

    debugLogger.providerApi.info('cfx_sendTransaction', request, transaction);
    const result = await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        encodedTx: transaction,
      },
    );

    debugLogger.providerApi.info(
      'cfx_sendTransaction DONE',
      result,
      request,
      transaction,
    );

    return result;
  }

  @providerApiMethod()
  cfx_signTypedData_v4() {
    // Temporarily not supported
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  async net_version() {
    return this.cfx_netVersion();
  }

  @providerApiMethod()
  async personal_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    const message = messages[0];

    return this._showSignMessageModal(request, {
      type: ETHMessageTypes.PERSONAL_SIGN,
      message,
      payload: messages,
    });
  }

  @providerApiMethod()
  cfx_sign(req: IJsBridgeMessagePayload, ...messages: any[]) {
    return this._showSignMessageModal(req, {
      type: ETHMessageTypes.ETH_SIGN,
      message: messages[1],
      payload: messages,
    });
  }

  @providerApiMethod()
  wallet_addConfluxChain() {
    // Temporarily not supported
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  wallet_getBalance(_: IJsBridgeMessagePayload, ...params: any[]) {
    return this.rpcCall({
      method: 'cfx_getBalance',
      params,
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
    // Temporarily not supported
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
  async wallet_watchAsset(
    request: IJsBridgeMessagePayload,
    params: WatchAssetParameters,
  ) {
    const type = params.type ?? '';
    if (type !== 'ERC20' && type !== 'CRC20') {
      throw new Error(`Asset of type '${type}' not supported`);
    }
    const result = await this.backgroundApi.serviceDapp?.openAddTokenModal(
      request,
      params,
    );
    return result;
  }
}

export default ProviderApiConflux;
