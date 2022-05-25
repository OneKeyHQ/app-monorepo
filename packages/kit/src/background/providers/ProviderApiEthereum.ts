/* eslint-disable @typescript-eslint/lines-between-class-members, lines-between-class-members, max-classes-per-file, camelcase, @typescript-eslint/no-unused-vars */

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import uuid from 'react-native-uuid';

// import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import { EvmExtraInfo } from '@onekeyhq/engine/src/types/network';
import type VaultEvm from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IEncodedTxEvm,
  IUnsignedMessageEvm,
} from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getActiveWalletAccount } from '../../hooks/redux';
import { ModalRoutes } from '../../routes/routesEnum';
import { SendRoutes } from '../../views/Send/types';
import { backgroundClass, permissionRequired } from '../decorators';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

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
  gas?: string;
  gasPrice?: string;
  gasUsed?: string;
  nonce?: string;
  to?: string;
  value?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedBaseFee?: string;
}

export type WatchAssetParameters = {
  type: string; // The asset's interface, e.g. 'ERC20'
  options: {
    address: string; // The hexadecimal Ethereum address of the token contract
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

@backgroundClass()
class ProviderApiEthereum extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ethereum;

  async _getCurrentUnlockState() {
    return Promise.resolve(true);
  }

  _getCurrentNetworkExtraInfo(): EvmExtraInfo {
    const { network } = getActiveWalletAccount();
    // return a random chainId in non-evm, as empty string may cause dapp error
    let networkInfo: EvmExtraInfo = {
      chainId: '0x736d17dc',
      networkVersion: '1936529372',
    };
    if (network && network.impl === IMPL_EVM) {
      networkInfo = network.extraInfo as EvmExtraInfo;
    }
    return networkInfo;
  }

  // ----------------------------------------------
  /**
   * Depends on the data we have, show contract call or send confirm modal to the user
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Multicall.tsx").default} contract modal
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/SendConfirm.tsx").default} send modal
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Approve.tsx").default} approve modal
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
  async eth_sendTransaction(
    request: IJsBridgeMessagePayload,
    transaction: Transaction,
  ) {
    debugLogger.ethereum('eth_sendTransaction', request, transaction);
    // Parse transaction
    // const { from, to, value, gasLimit, gasPrice, data, nonce, type } =
    //   transaction;

    const result = await this.backgroundApi.serviceDapp?.openApprovalModal(
      request,
      {
        encodedTx: transaction,
      },
    );

    debugLogger.ethereum(
      'eth_sendTransaction DONE',
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
        if (permissionName === 'eth_accounts') {
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

  async eth_requestAccounts(request: IJsBridgeMessagePayload) {
    debugLogger.backgroundApi(
      'ProviderApiEthereum.eth_requestAccounts',
      request,
    );

    const accounts = await this.eth_accounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }

    await this.backgroundApi.serviceDapp.openConnectionModal(request);
    return this.eth_accounts(request);

    // TODO show approval confirmation, skip in whitelist domain
  }

  eth_coinbase(request: IJsBridgeMessagePayload) {
    // TODO some different with eth_accounts, check metamask code source
    return this.eth_accounts(request);
  }

  async eth_accounts(request: IJsBridgeMessagePayload) {
    const accounts = this.backgroundApi.serviceDapp?.getConnectedAccounts({
      origin: request.origin as string,
    });
    if (!accounts) {
      return Promise.resolve([]);
    }
    const accountAddresses = accounts.map((account) => account.address);
    return Promise.resolve(accountAddresses);
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
    throw web3Errors.rpc.invalidParams(
      'eth_sign requires 32 byte message hash',
    );
  }

  async showSignMessageModal(
    request: IJsBridgeMessagePayload,
    unsignedMessage: IUnsignedMessageEvm,
  ) {
    const result = await this.backgroundApi.serviceDapp?.openApprovalModal(
      request,
      {
        unsignedMessage,
      },
    );
    return result;
  }

  eth_subscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  eth_unsubscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  /** Sign unapproved message
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Signature.tsx").default} modal
   * arg req: IJsBridgeMessagePayload, ...[msg, from, passphrase]
   */
  eth_sign(req: IJsBridgeMessagePayload, ...messages: any[]) {
    console.log('eth_sign', messages, req);
    return this.showSignMessageModal(req, {
      type: ETHMessageTypes.ETH_SIGN,
      message: messages[1],
      payload: messages,
    });
  }

  personal_sign(req: IJsBridgeMessagePayload, ...messages: any[]) {
    const message = messages[0] as string;

    // TODO utf8 text display in UI
    // TODO remove convert hex to utf8 test
    // if (message.startsWith('0x')) {
    //   const buffer = Buffer.from(message.substr(2), 'hex');
    //   message = buffer.toString('utf8');
    // }

    console.log('personal_sign', message, messages, req);
    return this.showSignMessageModal(req, {
      type: ETHMessageTypes.PERSONAL_SIGN,
      message,
      payload: messages,
    });
  }

  async personal_ecRecover(
    req: IJsBridgeMessagePayload,
    ...messages: string[]
  ) {
    console.log('personal_ecRecover: ', req, messages);
    const [message, signature] = messages;
    if (
      typeof message === 'string' &&
      typeof signature === 'string' &&
      // Signature is 65-bytes in length, length of its hexstring is 132.
      signature.length === 132
    ) {
      const { networkId } = getActiveWalletAccount();
      // Not interacting with user's credential, only a static method, so any
      // vault would do.
      const evmWatchVault =
        await this.backgroundApi.engine.vaultFactory.getChainOnlyVault(
          networkId,
        );
      const result = await (evmWatchVault as VaultEvm).personalECRecover(
        message,
        signature,
      );
      console.log('personal_ecRecover: ', req, messages, result);
      return result;
    }
    throw web3Errors.rpc.invalidParams(
      'personal_ecRecover requires a message and a 65 bytes signature.',
    );
  }

  eth_signTypedData(req: IJsBridgeMessagePayload, ...messages: any[]) {
    console.log('eth_signTypedData', messages, req);
    return this.showSignMessageModal(req, {
      type: ETHMessageTypes.TYPED_DATA_V1,
      message: JSON.stringify(messages[0]),
      payload: messages,
    });
  }

  eth_signTypedData_v1(req: IJsBridgeMessagePayload, ...messages: any[]) {
    // @ts-ignore
    return this.eth_signTypedData(req, ...messages);
  }

  eth_signTypedData_v3(req: IJsBridgeMessagePayload, ...messages: any[]) {
    console.log('eth_signTypedData_v3', messages, req);
    return this.showSignMessageModal(req, {
      type: ETHMessageTypes.TYPED_DATA_V3,
      message: messages[1],
      payload: messages,
    });
  }

  eth_signTypedData_v4(req: IJsBridgeMessagePayload, ...messages: any[]) {
    console.log('eth_signTypedData_v4', messages, req);
    return this.showSignMessageModal(req, {
      type: ETHMessageTypes.TYPED_DATA_V4,
      message: messages[1],
      payload: messages,
    });
  }

  async eth_chainId() {
    const networkExtraInfo = this._getCurrentNetworkExtraInfo();
    return Promise.resolve(networkExtraInfo.chainId);
  }

  async net_version() {
    const networkExtraInfo = this._getCurrentNetworkExtraInfo();
    return Promise.resolve(networkExtraInfo.networkVersion);
  }

  // TODO @publicMethod()
  async metamask_getProviderState(request: IJsBridgeMessagePayload) {
    return {
      accounts: await this.eth_accounts(request),
      chainId: await this.eth_chainId(),
      networkVersion: await this.net_version(),
      isUnlocked: await this._getCurrentUnlockState(),
    };
  }

  // get and save Dapp site icon & title
  metamask_sendDomainMetadata() {
    // TODO
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
   * req: IJsBridgeMessagePayload,
    {
      chainId,
      chainName = null,
      blockExplorerUrls = null,
      nativeCurrency = null,
      rpcUrls,
    },
   */
  async wallet_addEthereumChain(
    request: IJsBridgeMessagePayload,
    params: AddEthereumChainParameter,
  ) {
    const result = await this.backgroundApi.serviceDapp?.openAddNetworkModal(
      request,
      params,
    );
    return result;
  }

  /**
   * Add switch to a chain, we also need a request modal UI
   * req: IJsBridgeMessagePayload, { chainId }
   */
  wallet_switchEthereumChain() {
    // TODO
    return false;
  }

  // ----------------------------------------------

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    const { networkId } = getActiveWalletAccount();
    debugLogger.ethereum('BgApi rpcCall:', request, { networkId });
    // TODO error if networkId empty, or networkImpl not EVM
    const result = await this.backgroundApi.engine.proxyJsonRPCCall(
      networkId,
      request,
    );
    debugLogger.ethereum('BgApi rpcCall RESULT:', request, {
      networkId,
      result,
    });
    return result;
  }

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'metamask_accountsChanged',
        params: await this.eth_accounts({ origin }),
      };
      return result;
    };
    // debugLogger.ethereum('notifyDappAccountsChanged', data);
    info.send(data);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async () => {
      const result = {
        method: 'metamask_chainChanged',
        params: {
          chainId: await this.eth_chainId(),
          networkVersion: await this.net_version(),
        },
      };
      return result;
    };

    info.send(data);
  }

  // TODO metamask_unlockStateChanged

  // TODO throwMethodNotFound
}

export default ProviderApiEthereum;
