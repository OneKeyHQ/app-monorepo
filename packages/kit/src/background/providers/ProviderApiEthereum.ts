/* eslint-disable @typescript-eslint/lines-between-class-members, lines-between-class-members, max-classes-per-file, camelcase, @typescript-eslint/no-unused-vars */

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import { get } from 'lodash';
import uuid from 'react-native-uuid';

// import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import { IMPL_EVM } from '@onekeyhq/engine/src/constants';
import { fixAddressCase, toBigIntHex } from '@onekeyhq/engine/src/engineUtils';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import { EvmExtraInfo, Network } from '@onekeyhq/engine/src/types/network';
import type VaultEvm from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import {
  IEncodedTxEvm,
  IUnsignedMessageEvm,
} from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getActiveWalletAccount } from '../../hooks/redux';
import { ModalRoutes } from '../../routes/routesEnum';
import { SendRoutes } from '../../views/Send/types';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '../decorators';
import { isDappScopeMatchNetwork } from '../utils';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

import type { IUpdateChainParams } from '@walletconnect/types';

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
class ProviderApiEthereum extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ethereum;

  async _getCurrentUnlockState() {
    return Promise.resolve(true);
  }

  _getCurrentNetworkExtraInfo(): EvmExtraInfo {
    const { network } = getActiveWalletAccount();
    // return a mocked chainId in non-evm, as empty string may cause dapp error
    let networkInfo: EvmExtraInfo = {
      chainId: '0x736d17dc',
      networkVersion: '1936529372',
    };
    if (network && network.impl === IMPL_EVM) {
      networkInfo = network.extraInfo as EvmExtraInfo;
    }
    return networkInfo;
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
    const { networkId } = getActiveWalletAccount();
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
        method: 'metamask_accountsChanged',
        params: await this.eth_accounts({ origin }),
      };
      return result;
    };
    // debugLogger.providerApi.info('notifyDappAccountsChanged', data);
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
  @providerApiMethod()
  async eth_sendTransaction(
    request: IJsBridgeMessagePayload,
    transaction: Transaction,
  ) {
    // TODO check tx from address match current account
    debugLogger.providerApi.info('eth_sendTransaction', request, transaction);
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
      'eth_sendTransaction DONE',
      result,
      request,
      transaction,
    );

    return result;
  }

  /**
   * Add token to user wallet
   * const result = await window.ethereum.request({
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

  @providerApiMethod()
  async wallet_getPermissions(request: IJsBridgeMessagePayload) {
    const result = [
      {
        caveats: [],
        date: Date.now(),
        id: request.id?.toString() ?? (uuid.v4() as string),
        invoker: request.origin as string,
        parentCapability: 'eth_accounts',
      },
    ];
    return Promise.resolve(result);
  }

  @providerApiMethod()
  async eth_requestAccounts(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info(
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

  @providerApiMethod()
  async eth_coinbase(request: IJsBridgeMessagePayload): Promise<string | null> {
    const accounts = await this.eth_accounts(request);
    return accounts?.[0] || null;
  }

  @providerApiMethod()
  async eth_accounts(request: IJsBridgeMessagePayload) {
    const accounts = this.backgroundApi.serviceDapp?.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_EVM,
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
  eth_signTransaction(req: IJsBridgeMessagePayload, ...params: string[]) {
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  eth_subscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  eth_unsubscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  /** Sign unapproved message
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Signature.tsx").default} modal
   * arg req: IJsBridgeMessagePayload, ...[msg, from, passphrase]
   */
  @providerApiMethod()
  eth_sign(req: IJsBridgeMessagePayload, ...messages: any[]) {
    return this._showSignMessageModal(req, {
      type: ETHMessageTypes.ETH_SIGN,
      message: messages[1],
      payload: messages,
    });
  }

  @providerApiMethod()
  async personal_sign(req: IJsBridgeMessagePayload, ...messages: any[]) {
    let message = messages[0] as string;

    const accounts = await this.eth_accounts(req);
    // FIX:  dydx use second param as message
    if (accounts && accounts.length) {
      const a = fixAddressCase({
        impl: IMPL_EVM,
        address: messages[0] || '',
      });
      const b = fixAddressCase({
        impl: IMPL_EVM,
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

      return result;
    }
    throw web3Errors.rpc.invalidParams(
      'personal_ecRecover requires a message and a 65 bytes signature.',
    );
  }

  async isEthAddress(address: string | null) {
    const result = await backgroundApiProxy.getState();
    const networkId = get(result, 'state.general.activeNetworkId', null);

    if (!networkId || !address) {
      return false;
    }

    try {
      await backgroundApiProxy.validator.validateAddress(networkId, address);
      return true;
    } catch {
      return false;
    }
  }

  @providerApiMethod()
  async eth_signTypedData(req: IJsBridgeMessagePayload, ...messages: any[]) {
    /**
     * Verify and switch the order as needed to ensure maximum compatibility with DApps
     */
    let message;
    if (messages.length && messages[0]) {
      message = messages[0] ?? null;
      if (await this.isEthAddress(messages[0] ?? null)) {
        message = messages[1] ?? null;
      }
    }

    let parsedData = message;
    try {
      parsedData = typeof message === 'string' && JSON.parse(message);
      // eslint-disable-next-line no-empty
    } catch {}

    /**
     * v1: basic type
     * v3: has types / primaryType / domain
     * v4: Same as V3, but also supports arrays and recursive structures.
     * Because V4 is backward compatible with V3, we only support V4
     */
    const { types, primaryType, domain } = parsedData;
    let ethMessageType = ETHMessageTypes.TYPED_DATA_V1;
    if (typeof parsedData === 'object' && (types || primaryType || domain)) {
      ethMessageType = ETHMessageTypes.TYPED_DATA_V4;
    }

    // Convert to a JSON string
    let messageStr = message;
    if (typeof message === 'object') {
      messageStr = JSON.stringify(message);
    }
    return this._showSignMessageModal(req, {
      type: ethMessageType,
      message: messageStr,
      payload: messages,
    });
  }

  @providerApiMethod()
  eth_signTypedData_v1(req: IJsBridgeMessagePayload, ...messages: any[]) {
    // @ts-ignore
    return this.eth_signTypedData(req, ...messages);
  }

  @providerApiMethod()
  eth_signTypedData_v3(req: IJsBridgeMessagePayload, ...messages: any[]) {
    console.log('eth_signTypedData_v3', messages, req);
    return this._showSignMessageModal(req, {
      type: ETHMessageTypes.TYPED_DATA_V3,
      message: messages[1],
      payload: messages,
    });
  }

  @providerApiMethod()
  eth_signTypedData_v4(req: IJsBridgeMessagePayload, ...messages: any[]) {
    console.log('eth_signTypedData_v4', messages, req);
    return this._showSignMessageModal(req, {
      type: ETHMessageTypes.TYPED_DATA_V4,
      message: messages[1],
      payload: messages,
    });
  }

  @providerApiMethod()
  async eth_chainId() {
    const networkExtraInfo = this._getCurrentNetworkExtraInfo();
    return Promise.resolve(networkExtraInfo.chainId);
  }

  @providerApiMethod()
  async net_version() {
    const networkExtraInfo = this._getCurrentNetworkExtraInfo();
    return Promise.resolve(networkExtraInfo.networkVersion);
  }

  @providerApiMethod()
  async metamask_getProviderState(request: IJsBridgeMessagePayload) {
    return {
      accounts: await this.eth_accounts(request),
      chainId: await this.eth_chainId(),
      networkVersion: await this.net_version(),
      isUnlocked: await this._getCurrentUnlockState(),
    };
  }

  // for WalletConnect method: connector.updateChain(params: IUpdateChainParams)
  @providerApiMethod()
  async wallet_updateChain(
    request: IJsBridgeMessagePayload,
    params: IUpdateChainParams,
  ) {
    debugLogger.walletConnect.info(
      'wallet_updateChain by wallet-connect',
      request,
    );
    return this.wallet_addEthereumChain(request, {
      ...params,
      chainId: toBigIntHex(new BigNumber(params.chainId)),
      nativeCurrency: {
        decimals: 18,
        ...params.nativeCurrency,
      },
      rpcUrls: [params.rpcUrl].filter(Boolean),
    });
  }

  // get and save Dapp site icon & title
  @providerApiMethod()
  metamask_sendDomainMetadata() {
    // TODO
    return {};
  }

  @providerApiMethod()
  metamask_logWeb3ShimUsage() {
    // TODO
    return {};
  }

  @providerApiMethod()
  eth_subscription() {
    // TODO
    return {};
  }

  /**
   * Add new chain to wallet and switch to it, we also need a request modal UI
   * req: IJsBridgeMessagePayload,
    {
      chainId='0xf00',
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
    // TODO debounced switch chain
    const networks = await this.backgroundApi.serviceNetwork.fetchNetworks();
    const networkId = `evm--${parseInt(params.chainId)}`;
    const included = networks.some((network) => network.id === networkId);
    if (!included) {
      // throw new Error(
      //   `Unrecognized chain ID ${params.chainId}. Try adding the chain using wallet_addEthereumChain first.`,
      // );
      return null;
    }

    const { network } = getActiveWalletAccount();
    if (params.chainId === network?.extraInfo?.chainId) {
      return convertToEthereumChainResult(network);
    }

    const result = await this.backgroundApi.serviceDapp?.openSwitchNetworkModal(
      request,
      params,
    );
    // Metamask return null
    return convertToEthereumChainResult(result as any);
  }

  // TODO metamask_unlockStateChanged

  // TODO throwMethodNotFound
}

export default ProviderApiEthereum;
