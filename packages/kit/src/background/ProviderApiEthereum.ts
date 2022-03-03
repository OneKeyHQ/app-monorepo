/* eslint-disable camelcase */

import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

// import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
// import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// import engine from '../engine/EngineProvider';
import { DappConnectionModalRoutes } from '../routes';
import { ModalRoutes } from '../routes/types';
import extUtils from '../utils/extUtils';

import { permissionRequired } from './decorators';
import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

class ProviderApiEthereum extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ethereum;

  _getCurrentAccounts() {
    return [];
    // return this.walletApi.isConnected ? [this.walletApi.selectedAddress] : [];
    // return this.walletApi.getCurrentAccounts();
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

  @permissionRequired()
  eth_sendTransaction() {
    if (platformEnv.isExtension) {
      return extUtils.openApprovalWindow();
    }
    return Promise.resolve({ txid: '111110000' });
  }

  async wallet_getDebugLoggerSettings() {
    const result = (await debugLogger.debug?.load()) || '';
    return result;
  }

  async eth_requestAccounts(request: IJsBridgeMessagePayload) {
    debugLogger.backgroundApi('eth_requestAccounts', request);

    const result = await this.openDappApprovalModal({
      request,
      screens: [
        ModalRoutes.DappConnectionModal,
        DappConnectionModalRoutes.ConnectionModal,
      ],
    });
    return result;

    // TODO show approval confirmation, skip in whitelist domain
    // if (!this.walletApi.isConnected) {
    //   // this.walletApi.isConnected = true;
    // }
    //
    // return this.eth_accounts();
  }

  eth_coinbase() {
    // TODO some different with eth_accounts, check metamask code source
    return this.eth_accounts();
  }

  eth_accounts() {
    return this._getCurrentAccounts();
  }

  eth_chainId() {
    return this._getCurrentChainId();
  }

  net_version() {
    return this._getCurrentNetworkVersion();
  }

  // TODO @publicMethod()
  async metamask_getProviderState() {
    // pass debugLoggerSettings to dapp injected provider
    const debugLoggerSettings = (await debugLogger?.debug?.load()) ?? '';
    return {
      accounts: this._getCurrentAccounts(),
      chainId: this._getCurrentChainId(),
      isUnlocked: this._getCurrentUnlockState(),
      networkVersion: this._getCurrentNetworkVersion(),
      debugLoggerSettings,
    };
  }

  // get and save Dapp site icon & title
  metamask_sendDomainMetadata() {
    // TODO save to DB
    return {};
  }

  metamask_logWeb3ShimUsage() {
    // TODO
    return {};
  }

  eth_subscription() {
    // TODO
    return {};
  }

  // ----------------------------------------------

  protected async rpcCall(request: IJsonRpcRequest): Promise<any> {
    console.log('MOCK CHAIN RPC CALL:', request);
    return Promise.resolve({});
    // const networkId = `${IMPL_EVM}--${this._getCurrentChainId()}`;
    // const result = await engine.proxyRPCCall(networkId, request);
    // return { id: request.id, jsonrpc: request.jsonrpc || '2.0', result };
    // TODO use metamask error object
    // throw new Error(`provider method=${request.method} NOT SUPPORTED yet!`);
  }

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = {
      method: 'metamask_accountsChanged',
      params: info.accounts || [],
    };
    // console.log('notifyDappAccountsChanged', data);
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

  // ----------------------------------------------

  /*
  private async signMessage(
    type: ETHMessageTypes,
    message: string,
  ): Promise<string> {
    const networkId = `${IMPL_EVM}--${this._getCurrentChainId()}`;
    const password = '';
    const accountId = '';
    const signatures = await engine.signMessage(
      password,
      networkId,
      accountId,
      [{ type, message }],
    );
    return signatures[0];
  }

  personal_sign(message: string): Promise<string> {
    return this.signMessage(ETHMessageTypes.PERSONAL_SIGN, message);
  }

  eth_sign(message: string): Promise<string> {
    return this.signMessage(ETHMessageTypes.ETH_SIGN, message);
  }

  eth_signTypedData(message: string): Promise<string> {
    return this.signMessage(ETHMessageTypes.TYPED_DATA_V1, message);
  }

  eth_signTypedData_v1(message: string): Promise<string> {
    return this.eth_signTypedData(message);
  }

  eth_signTypedData_v3(message: string): Promise<string> {
    return this.signMessage(ETHMessageTypes.TYPED_DATA_V3, message);
  }

  eth_signTypedData_v4(message: string): Promise<string> {
    return this.signMessage(ETHMessageTypes.TYPED_DATA_V4, message);
  }
  */
}

export default ProviderApiEthereum;
