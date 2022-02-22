/* eslint-disable camelcase */

import { permissionRequired } from '@onekeyhq/inpage-provider/src/provider/decorators';
import {
  IInjectedProviderNames,
  IJsonRpcRequest,
} from '@onekeyhq/inpage-provider/src/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import extUtils from '../utils/extUtils';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

class ProviderApiEthereum extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ethereum;

  _getCurrentAccounts() {
    // return this.walletApi.isConnected ? [this.walletApi.selectedAddress] : [];
    return this.walletApi.getCurrentAccounts();
  }

  _getCurrentChainId() {
    return this.walletApi.getCurrentNetwork().chainId;
  }

  _getCurrentNetworkVersion() {
    return `${parseInt(this._getCurrentChainId(), 16)}`;
  }

  _getCurrentUnlockState() {
    return true;
  }

  // ----------------------------------------------

  // @ts-expect-error
  @permissionRequired()
  eth_sendTransaction() {
    if (platformEnv.isExtension) {
      return extUtils.openApprovalWindow();
    }
    return Promise.resolve(this.rpcResult({ txid: '111110000' }));
  }

  async wallet_getDebugLoggerSettings() {
    const result = (await debugLogger.debug?.load()) || '';
    return this.rpcResult(result);
  }

  eth_requestAccounts() {
    // TODO show approval confirmation, skip in whitelist domain
    console.log('=============== confirm check');
    if (!this.walletApi.isConnected) {
      this.walletApi.isConnected = true;
    }

    return this.eth_accounts();
  }

  eth_coinbase() {
    // TODO some different with eth_accounts, check metamask code source
    return this.eth_accounts();
  }

  eth_accounts() {
    return this.rpcResult(this._getCurrentAccounts());
  }

  eth_chainId() {
    return this.rpcResult(this._getCurrentChainId());
  }

  net_version() {
    return this.rpcResult(this._getCurrentNetworkVersion());
  }

  eth_blockNumber() {
    return this.rpcResult('0xd29f1a');
  }

  // TODO @publicMethod()
  async metamask_getProviderState() {
    // pass debugLoggerSettings to dapp injected provider
    const debugLoggerSettings = (await debugLogger?.debug?.load()) ?? '';
    return this.rpcResult({
      accounts: this._getCurrentAccounts(),
      chainId: this._getCurrentChainId(),
      isUnlocked: this._getCurrentUnlockState(),
      networkVersion: this._getCurrentNetworkVersion(),
      debugLoggerSettings,
    });
  }

  // get and save Dapp site icon & title
  metamask_sendDomainMetadata() {
    // TODO save to DB
    return this.rpcResult({});
  }

  metamask_logWeb3ShimUsage() {
    // TODO
    return this.rpcResult({});
  }

  eth_subscription() {
    // TODO
    return this.rpcResult({});
  }

  // ----------------------------------------------

  protected rpcCall(request: IJsonRpcRequest): any {
    console.log('MOCK CHAIN RPC CALL:', request);
    return this.rpcResult({});
    // TODO use metamask error object
    // throw new Error(`provider method=${request.method} NOT SUPPORTED yet!`);
  }

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = {
      method: 'metamask_accountsChanged',
      params: info.accounts || [],
    };
    info.send(data);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = {
      method: 'metamask_chainChanged',
      params: { chainId: info.chainId, networkVersion: info.networkVersion },
    };
    info.send(data);
  }

  // TODO metamask_unlockStateChanged

  // TODO throwMethodNotFound
}

export default ProviderApiEthereum;
