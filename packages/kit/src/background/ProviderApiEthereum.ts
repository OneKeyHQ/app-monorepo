/* eslint-disable @typescript-eslint/lines-between-class-members, lines-between-class-members, max-classes-per-file, camelcase */
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import { ethErrors } from 'eth-rpc-errors';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

  /**
   * Depends on the data we have, show contract call or send confirm modal to the user
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Multicall.tsx").default} contract modal
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/SendConfirm.tsx").default} send modal
   *
   * Example:
   * const result = await ethereum.request({
   *    method: 'eth_sendTransaction',
   *    params: [
   *      {
   *        from: accounts[0],
   *        to: '0x0c54FcCd2e384b4BB6f2E405Bf5Cbc15a017AaFb',
   *        value: '0x0',
   *        gasLimit: '0x5028',
   *        gasPrice: '0x2540be400',
   *        type: '0x0',
   *      },
   *    ],
   *  });
   */
  @permissionRequired()
  eth_sendTransaction(
    req,
    { from, to, value, gasLimit, gasPrice, data, nonce },
  ) {
    if (platformEnv.isExtension) {
      return extUtils.openApprovalWindow();
    }
    return Promise.resolve({ txid: '111110000' });
  }

  /**
   * Add token to user wallet
   * const result = await ethereum.request({
   *   method: 'wallet_watchAsset',
   *   params: {
   *     type: 'ERC20',
   *     options: {
   *       address: contract.address,
   *       symbol: _tokenSymbol,
   *       decimals: _decimalUnits,
   *       image: 'https://metamask.github.io/test-dapp/metamask-fox.svg',
   *     },
   *   },
   * });
   */
  @permissionRequired()
  wallet_watchAsset(
    req,
    { type, options: { address, symbol, decimals, image } },
  ) {
    return this.rpcResult({});
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
  }

  eth_coinbase() {
    // TODO some different with eth_accounts, check metamask code source
    return this.eth_accounts();
  }

  /** Sign transaction
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Signature.tsx").default} modal
   */
  eth_signTransaction(req: IJsBridgeMessagePayload, ...params: string[]) {
    if (params[1].length === 66 || params[1].length === 67) {
      // const rawSignature = await addUnapprovedMessage({
      //   data: params[1]
      //   from: params[0]
      // // dapp metadata
      //   ...{
      //     url, title, icon
      //   },
      //   origin: req.origin
      // })
      // return signature
      throw new Error('eth_signTransaction not supported yet');
    }
    throw ethErrors.rpc.invalidParams('eth_sign requires 32 byte message hash');
  }

  /** Sign unapproved message
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Signature.tsx").default} modal
   */
  eth_sign(req: IJsBridgeMessagePayload, ...[msg, from, passphrase]) {
    throw new Error('eth_sign not supported yet');
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

  eth_blockNumber() {
    return '0xd29f1a';
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

  /**
   * Add new chain to wallet and switch to it, we also need a request modal UI
   */
  wallet_addEthereumChain(
    req: IJsBridgeMessagePayload,
    {
      chainId,
      chainName = null,
      blockExplorerUrls = null,
      nativeCurrency = null,
      rpcUrls,
    },
  ) {
    // TODO
    return this.rpcResult({});
  }

  /**
   * Add switch to a chain, we also need a request modal UI
   */
  wallet_switchEthereumChain(req: IJsBridgeMessagePayload, { chainId }) {
    // TODO
    return this.rpcResult({});
  }

  // ----------------------------------------------

  protected rpcCall(request: IJsonRpcRequest): any {
    console.log('MOCK CHAIN RPC CALL:', request);
    return {};
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
}

export default ProviderApiEthereum;
