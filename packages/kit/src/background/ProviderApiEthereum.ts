/* eslint-disable camelcase */

import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

// import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
// import engine from '../engine/EngineProvider';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { EvmExtraInfo } from '@onekeyhq/engine/src/types/network';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getActiveWalletAccount } from '../hooks/redux';
import { DappConnectionModalRoutes } from '../routes';
import { ModalRoutes } from '../routes/types';
import extUtils from '../utils/extUtils';

import { permissionRequired } from './decorators';
import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

class ProviderApiEthereum extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ethereum;

  _getCurrentUnlockState() {
    return true;
  }

  _getCurrentNetworkExtraInfo(): EvmExtraInfo {
    const { network } = getActiveWalletAccount();
    // return a random chainId in non-evm, as empty string may cause dapp error
    let networkInfo: EvmExtraInfo = {
      chainId: '0x736d17dc',
      networkVersion: '1936529372',
    };
    if (network && network.network.impl === IMPL_EVM) {
      networkInfo = network.network.extraInfo as EvmExtraInfo;
    }
    return networkInfo;
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
    // debugLogger.backgroundApi('eth_requestAccounts', request);

    const accounts = this.eth_accounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }

    await this.backgroundApi.dappService?.openApprovalModal({
      request,
      screens: [
        ModalRoutes.DappConnectionModal,
        DappConnectionModalRoutes.ConnectionModal,
      ],
    });
    return this.eth_accounts(request);

    // TODO show approval confirmation, skip in whitelist domain
  }

  eth_coinbase(request: IJsBridgeMessagePayload) {
    // TODO some different with eth_accounts, check metamask code source
    return this.eth_accounts(request);
  }

  eth_accounts(request: IJsBridgeMessagePayload) {
    const accounts = this.backgroundApi.dappService?.getConnectedAccounts({
      origin: request.origin as string,
    });
    if (!accounts) {
      return [];
    }
    return accounts.map((account) => account.address);
  }

  eth_chainId() {
    const networkExtraInfo = this._getCurrentNetworkExtraInfo();
    return networkExtraInfo.chainId;
  }

  net_version() {
    const networkExtraInfo = this._getCurrentNetworkExtraInfo();
    return networkExtraInfo.networkVersion;
  }

  // TODO @publicMethod()
  async metamask_getProviderState(request: IJsBridgeMessagePayload) {
    // pass debugLoggerSettings to dapp injected provider
    const debugLoggerSettings = (await debugLogger?.debug?.load()) ?? '';
    return {
      accounts: this.eth_accounts(request),
      chainId: this.eth_chainId(),
      networkVersion: this.net_version(),
      isUnlocked: this._getCurrentUnlockState(),
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
    const data = ({ origin }: { origin: string }) => {
      const result = {
        method: 'metamask_accountsChanged',
        params: this.eth_accounts({ origin }),
      };
      return result;
    };
    // console.log('notifyDappAccountsChanged', data);
    info.send(data);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = () => {
      const result = {
        method: 'metamask_chainChanged',
        params: {
          chainId: this.eth_chainId(),
          networkVersion: this.net_version(),
        },
      };
      return result;
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
