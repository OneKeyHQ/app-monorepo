/* eslint-disable @typescript-eslint/lines-between-class-members, lines-between-class-members, max-classes-per-file, camelcase, @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import uuid from 'react-native-uuid';

// import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import type { EvmExtraInfo, Network } from '@onekeyhq/engine/src/types/network';
import type { IUnsignedMessageEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { IEncodedTxSTC } from '@onekeyhq/engine/src/vaults/impl/stc/types';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_STC } from '@onekeyhq/shared/src/engine/engineConsts';
import { fixAddressCase } from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

/**
 * @type Transaction
 *
 * Transaction representation
 * @property chainId - Network ID as per EIP-155
 * @property data - Data to pass with this transaction
 * @property from - Address to send this transaction from
 * @property gas - Gas to send with this transaction
 * @property gasPrice - Price of gas with this transaction
 * @property gasUsed -  Gas used in the transaction
 * @property nonce - Unique number to prevent replay attacks
 * @property to - Address to send this transaction to
 * @property value - Value associated with this transaction
 */
export interface Transaction {
  chainId?: number;
  data?: string;
  from: string;
  to?: string;
  value?: string;
  gas?: string;
  gasLimit?: number;
  gasPrice?: number;
  nonce?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedBaseFee?: string;
  expiredSecs?: number;
}

export type WatchAssetParameters = {
  type: string; // The asset's interface, e.g. 'ERC20'
  options: {
    address: string; // The hexadecimal Starcoin address of the token contract
    symbol?: string; // A ticker symbol or shorthand, up to 5 alphanumerical characters
    decimals?: number; // The number of asset decimals
    image?: string; // A string url of the token logo
  };
};

export type AddEthereumChainParameter = {
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

export type SwitchEthereumChainParameter = {
  chainId: string;
};

function convertToEthereumChainResult(result: Network | undefined | null) {
  return {
    id: result?.id,
    impl: result?.impl,
    symbol: result?.symbol,
    decimals: result?.decimals,
    logoURI: result?.logoURI,
    shortName: result?.shortName,
    shortCode: result?.shortCode,
    chainId: result?.extraInfo?.chainId,
    networkVersion: result?.extraInfo?.networkVersion,
  };
}

@backgroundClass()
class ProviderApiStarcoin extends ProviderApiBase {
  public providerName = IInjectedProviderNames.starcoin;
  async _getCurrentUnlockState() {
    return Promise.resolve(true);
  }

  async _getCurrentNetworkExtraInfo(): Promise<EvmExtraInfo> {
    const { network } = getActiveWalletAccount();
    // Give default value to prevent UI crashing
    let networkInfo: EvmExtraInfo = {
      chainId: '0x1',
      networkVersion: '1',
    };
    if (
      network &&
      network.impl === IMPL_STC &&
      Object.keys(network.extraInfo).length
    ) {
      networkInfo = network.extraInfo as EvmExtraInfo;
    } else {
      const request: IJsonRpcRequest = {
        id: 1,
        jsonrpc: '2.0',
        method: 'chain.id',
        params: [],
      };
      const result = await this.rpcCall(request);
      const resultId = (result as { id?: number | string })?.id;
      if (resultId) {
        networkInfo = {
          chainId: `0x${resultId.toString(16)}`,
          networkVersion: resultId.toString(),
        };
      }
    }
    return Promise.resolve(networkInfo);
  }

  async _showSignMessageModal(
    request: IJsBridgeMessagePayload,
    unsignedMessage: IUnsignedMessageEvm,
  ) {
    const result = await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        unsignedMessage,
      },
    );
    return result;
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    const { networkId, networkImpl } = getActiveWalletAccount();

    if (networkImpl !== IMPL_STC) {
      return;
    }
    debugLogger.providerApi.info('BgApi rpcCall:', request, { networkId });

    // TODO error if networkId empty, or networkImpl not EVM
    const result = await this.backgroundApi.engine.proxyJsonRPCCall(
      networkId,
      request,
    );

    debugLogger.providerApi.info('BgApi rpcCall RESULT:', request, {
      networkId,
      result,
    });
    return result;
  }

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'starmask_accountsChanged',
        params: await this.stc_accounts({ origin }),
      };
      return result;
    };
    // debugLogger.providerApi.info('notifyDappAccountsChanged', data);
    info.send(data);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async () => {
      const result = {
        method: 'starmask_chainChanged',
        params: {
          chainId: await this.eth_chainId(),
          networkVersion: await this.net_version(),
        },
      };
      return result;
    };

    info.send(data);
  }

  // ----------------------------------------------
  /**
   * Depends on the data we have, show contract call or send confirm modal to the user
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Multicall.tsx").default} contract modal
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/SendConfirm.tsx").default} send modal
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Approve.tsx").default} approve modal
   *
   * Example:
   * const result = await starcoin.request({
   *    method: 'stc_sendTransaction',
   *    params: [
   *      {
   *        from: accounts[0],
   *        to: '0x46ecE7c1e39fb6943059565E2621b312',
   *        value: '0xf4240',  // 0.001 STC
   *        gasLimit: 127845,
   *        gasPrice: 1,
   *      },
   *    ],
   *  });
   */
  @permissionRequired()
  @providerApiMethod()
  async stc_sendTransaction(
    request: IJsBridgeMessagePayload,
    transaction: IEncodedTxSTC,
  ) {
    debugLogger.providerApi.info('stc_sendTransaction', request, transaction);
    // Parse transaction
    // const { from, to, value, gasLimit, gasPrice, data, nonce, type } =
    //   transaction;

    const result = await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        encodedTx: transaction,
      },
    );

    debugLogger.providerApi.info(
      'stc_sendTransaction DONE',
      result,
      request,
      transaction,
    );

    return result;
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
  @providerApiMethod()
  async wallet_watchAsset(
    request: IJsBridgeMessagePayload,
    params: WatchAssetParameters,
  ) {
    const type = params.type ?? '';
    if (type !== 'ERC20') {
      throw new Error(`Asset of type '${type}' not supported`);
    }
    const result = await this.backgroundApi.serviceDapp?.openAddTokenModal(
      request,
      params,
    );
    return result;
  }

  // Not gonna do in this schedule but this method allow us to open ConnectionModal when connected account has cached
  // Select permitted accounts, update permissions and return accounts as result to DApp
  @providerApiMethod()
  async wallet_requestPermissions(
    request: IJsBridgeMessagePayload,
    permissions: Record<string, unknown>,
  ) {
    type Permission = {
      caveats: {
        type: string;
        value: string[];
      }[];
      // timestamp
      date: number;
      // Like a uuid
      id: string;
      // origin of the request
      invoker?: string;
      parentCapability: string;
    };

    const permissionRes =
      await this.backgroundApi.serviceDapp?.openConnectionModal(request);

    const result: Permission[] = Object.keys(permissions).map(
      (permissionName) => {
        if (permissionName === 'stc_accounts') {
          return {
            caveats: [
              {
                type: 'restrictReturnedAccounts',
                value: permissionRes as string[],
              },
            ],
            date: Date.now(),
            // TODO: Use new uuid?
            id: request.id?.toString() ?? (uuid.v4() as string),
            invoker: request.origin,
            parentCapability: permissionName,
          };
        }
        // other permissions
        return {
          caveats: [],
          date: Date.now(),
          id: request.id?.toString() ?? (uuid.v4() as string),
          invoker: request.origin,
          parentCapability: permissionName,
        };
      },
    );

    return result;
  }

  @providerApiMethod()
  async wallet_getPermissions(request: IJsBridgeMessagePayload) {
    const result = [
      {
        caveats: [],
        date: Date.now(),
        id: request.id?.toString() ?? (uuid.v4() as string),
        invoker: request.origin as string,
        parentCapability: 'stc_accounts',
      },
    ];
    return Promise.resolve(result);
  }

  @providerApiMethod()
  async stc_requestAccounts(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info(
      'ProviderApiStarcoin.stc_requestAccounts',
      request,
    );

    const accounts = await this.stc_accounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }

    await this.backgroundApi.serviceDapp.openConnectionModal(request);
    return this.stc_accounts(request);

    // TODO show approval confirmation, skip in whitelist domain
  }

  @providerApiMethod()
  async stc_coinbase(request: IJsBridgeMessagePayload): Promise<string | null> {
    const accounts = await this.stc_accounts(request);
    return accounts?.[0] || null;
  }

  @providerApiMethod()
  async stc_accounts(request: IJsBridgeMessagePayload) {
    const accounts = this.backgroundApi.serviceDapp?.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_STC,
      },
    );
    if (!accounts) {
      return Promise.resolve([]);
    }
    const accountAddresses = accounts.map((account) => account.address);
    return Promise.resolve(accountAddresses);
  }

  /** Sign transaction
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Signature.tsx").default} modal
   */
  @providerApiMethod()
  stc_signTransaction(req: IJsBridgeMessagePayload, ...params: string[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_subscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_unsubscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  /** Sign unapproved message
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Signature.tsx").default} modal
   * arg req: IJsBridgeMessagePayload, ...[msg, from, passphrase]
   */
  @providerApiMethod()
  stc_sign(req: IJsBridgeMessagePayload, ...messages: any[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async personal_sign(req: IJsBridgeMessagePayload, ...messages: any[]) {
    let message = messages[0] as string;

    const accounts = await this.stc_accounts(req);
    // FIX:  dydx use second param as message
    if (accounts && accounts.length) {
      const a = fixAddressCase({
        impl: IMPL_STC,
        address: messages[0] || '',
      });
      const b = fixAddressCase({
        impl: IMPL_STC,
        address: accounts[0] || '',
      });
      if (a && a === b && messages[1]) {
        message = messages[1] as string;
      }
    }

    return this._showSignMessageModal(req, {
      type: ETHMessageTypes.PERSONAL_SIGN,
      message,
      payload: messages,
    });
  }

  @providerApiMethod()
  async personal_ecRecover(
    req: IJsBridgeMessagePayload,
    ...messages: string[]
  ) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_signTypedData(req: IJsBridgeMessagePayload, ...messages: any[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_signTypedData_v1(req: IJsBridgeMessagePayload, ...messages: any[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_signTypedData_v3(req: IJsBridgeMessagePayload, ...messages: any[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_signTypedData_v4(req: IJsBridgeMessagePayload, ...messages: any[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async eth_chainId() {
    const networkExtraInfo = await this._getCurrentNetworkExtraInfo();
    return Promise.resolve(networkExtraInfo.chainId);
  }

  @providerApiMethod()
  async net_version() {
    const networkExtraInfo = await this._getCurrentNetworkExtraInfo();
    return Promise.resolve(networkExtraInfo.networkVersion);
  }

  @providerApiMethod()
  async starmask_getProviderState(request: IJsBridgeMessagePayload) {
    const networkExtraInfo = await this._getCurrentNetworkExtraInfo();
    return {
      accounts: await this.stc_accounts(request),
      chainId: networkExtraInfo.chainId,
      networkVersion: networkExtraInfo.networkVersion,
      isUnlocked: await this._getCurrentUnlockState(),
    };
  }

  // get and save Dapp site icon & title
  @providerApiMethod()
  starmask_sendDomainMetadata() {
    // TODO
    return {};
  }

  @providerApiMethod()
  starmask_logWeb3ShimUsage() {
    // TODO
    return {};
  }

  @providerApiMethod()
  stc_subscription() {
    // TODO
    return {};
  }

  /**
   * Add new chain to wallet and switch to it, we also need a request modal UI
   * req: IJsBridgeMessagePayload,
    {
      chainId,
      chainName = null,
      blockExplorerUrls = null,
      nativeCurrency = null,
      rpcUrls,
    },
   */
  @providerApiMethod()
  async wallet_addEthereumChain(
    request: IJsBridgeMessagePayload,
    params: AddEthereumChainParameter,
  ) {
    const networks = await this.backgroundApi.serviceNetwork.fetchNetworks();
    const networkId = `evm--${parseInt(params.chainId)}`;
    const included = networks.some((network) => network.id === networkId);
    if (included) {
      return this.wallet_switchEthereumChain(request, {
        chainId: params.chainId,
      });
    }

    const result = await this.backgroundApi.serviceDapp?.openAddNetworkModal(
      request,
      params,
    );
    // Metamask return null
    return convertToEthereumChainResult(result as any);
  }

  /**
   * Add switch to a chain, we also need a request modal UI
   * req: IJsBridgeMessagePayload, { chainId }
   */
  @providerApiMethod()
  async wallet_switchEthereumChain(
    request: IJsBridgeMessagePayload,
    params: SwitchEthereumChainParameter,
  ) {
    const networks = await this.backgroundApi.serviceNetwork.fetchNetworks();
    const networkId = `evm--${parseInt(params.chainId)}`;
    const included = networks.some((network) => network.id === networkId);
    if (!included) {
      // throw new Error(
      //   `Unrecognized chain ID ${params.chainId}. Try adding the chain using wallet_addEthereumChain first.`,
      // );
      return false;
    }

    const result = await this.backgroundApi.serviceDapp?.openSwitchNetworkModal(
      request,
      params,
    );
    // Metamask return null
    return convertToEthereumChainResult(result as any);
  }

  // TODO starmask_unlockStateChanged

  // TODO throwMethodNotFound
}

export default ProviderApiStarcoin;
